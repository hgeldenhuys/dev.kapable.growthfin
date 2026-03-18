/**
 * ScoreGauge Component
 * Circular gauge display for propensity score (0-100)
 *
 * Visual representation with color-coded arc:
 * - Hot (80-100): Red/Orange
 * - Warm (50-79): Yellow
 * - Cold (0-49): Blue
 */

import { cn } from '~/lib/utils';

interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ScoreGauge({
  score,
  size = 'md',
  showLabel = true,
  className,
}: ScoreGaugeProps) {
  // Clamp score between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Calculate rotation for the arc (270 degrees total, starting at -135deg)
  const rotation = -135 + (clampedScore / 100) * 270;

  // Get color based on score
  const getScoreColor = () => {
    if (clampedScore >= 80) return '#ef4444'; // red-500
    if (clampedScore >= 50) return '#eab308'; // yellow-500
    return '#3b82f6'; // blue-500
  };

  const getScoreGradient = () => {
    if (clampedScore >= 80) return 'from-orange-400 to-red-600';
    if (clampedScore >= 50) return 'from-yellow-400 to-orange-500';
    return 'from-blue-400 to-blue-600';
  };

  const getScoreLabel = () => {
    if (clampedScore >= 80) return 'Hot Lead';
    if (clampedScore >= 50) return 'Warm Lead';
    return 'Cold Lead';
  };

  // Get size dimensions
  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return { width: 120, height: 120, strokeWidth: 12, fontSize: 'text-2xl' };
      case 'lg':
        return { width: 240, height: 240, strokeWidth: 24, fontSize: 'text-5xl' };
      case 'md':
      default:
        return { width: 180, height: 180, strokeWidth: 18, fontSize: 'text-4xl' };
    }
  };

  const { width, height, strokeWidth, fontSize } = getDimensions();
  const radius = (width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = width / 2;

  // Calculate stroke dash array for the arc (270 degrees = 75% of circle)
  const arcLength = (circumference * 270) / 360;
  const scoreArcLength = (arcLength * clampedScore) / 100;
  const dashArray = `${scoreArcLength} ${circumference}`;

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="transform -rotate-90">
          {/* Background arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Score arc with gradient */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={getScoreColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
            style={{
              transformOrigin: 'center',
            }}
          />
        </svg>

        {/* Score text in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={cn('font-bold tabular-nums', fontSize)} style={{ color: getScoreColor() }}>
            {clampedScore}
          </div>
          <div className="text-xs text-muted-foreground mt-1">out of 100</div>
        </div>
      </div>

      {/* Label below gauge */}
      {showLabel && (
        <div className="mt-4 text-center">
          <p className="font-semibold text-sm" style={{ color: getScoreColor() }}>
            {getScoreLabel()}
          </p>
        </div>
      )}
    </div>
  );
}
