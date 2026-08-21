import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format bytes to human readable format
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Calculate traffic status based on usage and limit
export function getTrafficStatus(
  totalDownload: number,
  totalUpload: number,
  trafficLimitGB: number | null,
  trafficMode: 'down' | 'both' = 'down'
): { status: 'normal' | 'warning' | 'danger'; percentage: number; usedBytes: number } {
  if (!trafficLimitGB || trafficLimitGB <= 0) {
    return { status: 'normal', percentage: 0, usedBytes: 0 };
  }

  const usedBytes = trafficMode === 'both' ? totalDownload + totalUpload : totalDownload;
  const limitBytes = trafficLimitGB * 1024 * 1024 * 1024;
  const percentage = (usedBytes / limitBytes) * 100;

  let status: 'normal' | 'warning' | 'danger' = 'normal';
  if (percentage >= 100) {
    status = 'danger';
  } else if (percentage >= 80) {
    status = 'warning';
  }

  return { status, percentage, usedBytes };
}
