'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface TrafficSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  serverName: string;
  trafficLimitGB?: number;
  trafficMode: 'down' | 'both';
  trafficResetDay: number;
  onSave: (settings: { trafficLimitGB: number; trafficMode: 'down' | 'both'; trafficResetDay: number }) => void;
}

export function TrafficSettingsDialog({
  isOpen,
  onClose,
  serverName,
  trafficLimitGB = 0,
  trafficMode,
  trafficResetDay,
  onSave,
}: TrafficSettingsDialogProps) {
  const [limit, setLimit] = useState(trafficLimitGB);
  const [mode, setMode] = useState<'down' | 'both'>(trafficMode);
  const [resetDay, setResetDay] = useState(trafficResetDay);

  useEffect(() => {
    if (isOpen) {
      setLimit(trafficLimitGB);
      setMode(trafficMode);
      setResetDay(trafficResetDay);
    }
  }, [isOpen, trafficLimitGB, trafficMode, trafficResetDay]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ trafficLimitGB: limit, trafficMode: mode, trafficResetDay: resetDay });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--card)] rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">流量设置 - {serverName}</h2>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Traffic Limit */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              月流量上限 (GB)
            </label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
              min="0"
              step="1"
              placeholder="0 表示不限制"
            />
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              设置为 0 表示不限制流量
            </p>
          </div>

          {/* Traffic Mode */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              计费模式
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="trafficMode"
                  value="down"
                  checked={mode === 'down'}
                  onChange={() => setMode('down')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-[var(--foreground)]">仅计算下行流量</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="trafficMode"
                  value="both"
                  checked={mode === 'both'}
                  onChange={() => setMode('both')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-[var(--foreground)]">计算上下行流量总和</span>
              </label>
            </div>
          </div>

          {/* Reset Day */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              每月重置日期
            </label>
            <select
              value={resetDay}
              onChange={(e) => setResetDay(Number(e.target.value))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  每月 {day} 日
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              流量统计将在每月指定日期重置
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--foreground)] bg-[var(--secondary)] rounded-md hover:opacity-80"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm text-white bg-[var(--primary)] rounded-md hover:opacity-80"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
