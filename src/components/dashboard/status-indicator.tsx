'use client';

interface StatusIndicatorProps {
  online: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusIndicator({ online, size = 'md' }: StatusIndicatorProps) {
  const sizeMap = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  const ringSizeMap = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const dotSize = sizeMap[size];
  const ringSize = ringSizeMap[size];

  return (
    <span className="relative inline-flex items-center justify-center">
      {/* Pulse ring */}
      {online && (
        <span
          className={`absolute ${ringSize} rounded-full bg-[var(--status-online)] animate-pulse-ring`}
        />
      )}
      {/* Dot */}
      <span
        className={`relative ${dotSize} rounded-full ${
          online
            ? 'bg-[var(--status-online)] animate-pulse-glow'
            : 'bg-[var(--status-offline)]'
        }`}
        style={{
          boxShadow: online
            ? 'var(--glow-green)'
            : 'var(--glow-red)',
        }}
      />
    </span>
  );
}
