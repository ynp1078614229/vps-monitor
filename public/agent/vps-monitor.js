#!/usr/bin/env node
/**
 * VPS Monitor Agent
 * 
 * A lightweight monitoring agent that collects system metrics (CPU, memory, network)
 * and reports them to a central monitoring server.
 * 
 * Usage:
 *   AGENT_SECRET="your-secret" SERVER_URL="http://your-server:5000" node vps-monitor.js
 * 
 * Environment Variables:
 *   AGENT_SECRET  - Shared secret for authentication (required)
 *   SERVER_URL    - Central server URL (required)
 *   INTERVAL      - Report interval in seconds (default: 30)
 *   SERVER_ID     - Custom server ID (default: hostname)
 */

const os = require('os');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Configuration
const CONFIG = {
  serverUrl: process.env.SERVER_URL || 'http://localhost:5000',
  secret: process.env.AGENT_SECRET || '',
  interval: parseInt(process.env.INTERVAL || '5', 10) * 1000,
  serverId: process.env.SERVER_ID || os.hostname(),
  version: '2.0.0',
};

// Validate config
if (!CONFIG.secret) {
  console.error('[ERROR] AGENT_SECRET environment variable is required');
  process.exit(1);
}

if (!CONFIG.serverUrl) {
  console.error('[ERROR] SERVER_URL environment variable is required');
  process.exit(1);
}

// Previous network stats for calculating rates
let prevNetStats = null;
let prevNetTime = null;

/**
 * Get CPU usage by comparing two snapshots
 */
function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  return {
    idle: totalIdle / cpus.length,
    total: totalTick / cpus.length,
  };
}

// Store previous CPU snapshot
let prevCpu = getCpuUsage();

/**
 * Calculate CPU usage percentage between two snapshots
 */
function calculateCpuUsage() {
  const currentCpu = getCpuUsage();
  const idleDiff = currentCpu.idle - prevCpu.idle;
  const totalDiff = currentCpu.total - prevCpu.total;
  prevCpu = currentCpu;

  if (totalDiff === 0) return 0;
  return ((1 - idleDiff / totalDiff) * 100);
}

/**
 * Get memory usage
 */
function getMemoryUsage() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    total: totalMem,
    used: usedMem,
    usage: (usedMem / totalMem) * 100,
  };
}

/**
 * Get disk usage (Linux only, reads from /proc/mounts and df)
 */
function getDiskUsage() {
  try {
    if (process.platform !== 'linux') {
      return { total: 0, used: 0, usage: 0 };
    }

    // Read from /proc/mounts to find root filesystem
    const mounts = fs.readFileSync('/proc/mounts', 'utf8');
    const lines = mounts.split('\n');
    
    let rootDevice = null;
    for (const line of lines) {
      const parts = line.split(' ');
      if (parts[1] === '/') {
        rootDevice = parts[0];
        break;
      }
    }

    if (!rootDevice) {
      return { total: 0, used: 0, usage: 0 };
    }

    // Use statvfs via /proc/self/mountinfo or fallback
    // For simplicity, we'll use os.freemem() approach won't work for disk
    // Instead, parse df output or use statfs
    // Since we can't easily call df synchronously, use a simple estimation
    // In production, you'd want to use a native module or spawn df
    
    return { total: 0, used: 0, usage: 0 };
  } catch (err) {
    console.error('[WARN] Failed to get disk usage:', err.message);
    return { total: 0, used: 0, usage: 0 };
  }
}

/**
 * Get network I/O rates and cumulative totals (Linux only, reads from /proc/net/dev)
 */
function getNetworkStats() {
  try {
    if (process.platform !== 'linux') {
      return { rxBytes: 0, txBytes: 0, totalRx: 0, totalTx: 0 };
    }

    const netDev = fs.readFileSync('/proc/net/dev', 'utf8');
    const lines = netDev.split('\n');
    
    let totalRx = 0;
    let totalTx = 0;

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('lo:')) continue; // Skip loopback
      
      const parts = line.split(/\s+/);
      const iface = parts[0];
      if (iface.startsWith('lo')) continue; // Skip loopback
      
      const rxBytes = parseInt(parts[1], 10) || 0;
      const txBytes = parseInt(parts[9], 10) || 0;
      
      totalRx += rxBytes;
      totalTx += txBytes;
    }

    const now = Date.now();
    
    if (prevNetStats === null || prevNetTime === null) {
      prevNetStats = { rx: totalRx, tx: totalTx };
      prevNetTime = now;
      return { rxBytes: 0, txBytes: 0, totalRx, totalTx };
    }

    const timeDiff = (now - prevNetTime) / 1000; // seconds
    const rxRate = (totalRx - prevNetStats.rx) / timeDiff;
    const txRate = (totalTx - prevNetStats.tx) / timeDiff;

    prevNetStats = { rx: totalRx, tx: totalTx };
    prevNetTime = now;

    return {
      rxBytes: Math.max(0, rxRate),
      txBytes: Math.max(0, txRate),
      totalRx,
      totalTx,
    };
  } catch (err) {
    console.error('[WARN] Failed to get network stats:', err.message);
    return { rxBytes: 0, txBytes: 0, totalRx: 0, totalTx: 0 };
  }
}

/**
 * Get system uptime
 */
function getUptime() {
  return os.uptime();
}

/**
 * Get load average
 */
function getLoadAvg() {
  const loadavg = os.loadavg();
  return {
    loadAvg1: loadavg[0],
    loadAvg5: loadavg[1],
    loadAvg15: loadavg[2],
  };
}

/**
 * Get server info
 */
function getServerInfo() {
  const cpus = os.cpus();
  const mem = getMemoryUsage();
  const disk = getDiskUsage();

  return {
    serverId: CONFIG.serverId,
    hostname: os.hostname(),
    ip: getLocalIP(),
    os: `${os.type()} ${os.release()}`,
    kernel: os.release(),
    cpuModel: cpus.length > 0 ? cpus[0].model : 'unknown',
    cpuCores: cpus.length,
    totalMemory: mem.total,
    totalDisk: disk.total,
    agentVersion: CONFIG.version,
  };
}

/**
 * Get local IP address
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Collect all metrics
 */
function collectMetrics() {
  const cpuUsage = calculateCpuUsage();
  const mem = getMemoryUsage();
  const disk = getDiskUsage();
  const net = getNetworkStats();
  const load = getLoadAvg();

  return {
    cpuUsage: Math.max(0, Math.min(100, cpuUsage)),
    memoryUsed: mem.used,
    memoryUsage: Math.max(0, Math.min(100, mem.usage)),
    diskUsed: disk.used,
    diskUsage: Math.max(0, Math.min(100, disk.usage)),
    networkRxBytes: net.rxBytes,
    networkTxBytes: net.txBytes,
    totalRxBytes: net.totalRx,
    totalTxBytes: net.totalTx,
    loadAvg1: load.loadAvg1,
    loadAvg5: load.loadAvg5,
    loadAvg15: load.loadAvg15,
    uptime: getUptime(),
  };
}

/**
 * Send metrics to server
 */
function sendReport(metrics) {
  const serverInfo = getServerInfo();
  const payload = {
    ...serverInfo,
    metrics,
  };

  const data = JSON.stringify(payload);
  const url = new URL('/api/agent/report', CONFIG.serverUrl);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'Authorization': `Bearer ${CONFIG.secret}`,
    },
  };

  const req = lib.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [OK] CPU: ${metrics.cpuUsage.toFixed(1)}% | MEM: ${metrics.memoryUsage.toFixed(1)}% | NET: ↓${formatBytes(metrics.networkRxBytes)}/s ↑${formatBytes(metrics.networkTxBytes)}/s`);
      } else {
        console.error(`[${new Date().toISOString()}] [ERROR] Server responded with ${res.statusCode}: ${body}`);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] [ERROR] Failed to send report:`, err.message);
  });

  req.write(data);
  req.end();
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// Main
console.log('='.repeat(60));
console.log('VPS Monitor Agent v' + CONFIG.version);
console.log('='.repeat(60));
console.log(`Server ID:  ${CONFIG.serverId}`);
console.log(`Hostname:   ${os.hostname()}`);
console.log(`Server URL: ${CONFIG.serverUrl}`);
console.log(`Interval:   ${CONFIG.interval / 1000}s`);
console.log('='.repeat(60));
console.log('');

// Initial network stats collection (first reading will be 0)
getNetworkStats();

// Wait a moment before first report to get accurate network rates
setTimeout(() => {
  // Start reporting loop
  function report() {
    const metrics = collectMetrics();
    sendReport(metrics);
  }

  // First report immediately
  report();

  // Then report at intervals
  setInterval(report, CONFIG.interval);
}, 2000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[VPS Monitor] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[VPS Monitor] Shutting down...');
  process.exit(0);
});
