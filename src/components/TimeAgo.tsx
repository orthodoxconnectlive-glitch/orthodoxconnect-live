import React, { useState, useEffect } from 'react';
import { formatTimeAgo } from '../utils/timeAgo';

interface TimeAgoProps {
  date?: string | Date | number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export const TimeAgo: React.FC<TimeAgoProps> = ({
  date,
  className = '',
  prefix = '',
  suffix = '',
}) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Re-render every 15 seconds so relative times transition smoothly (e.g., JUST NOW -> 1m ago -> 2m ago)
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, [date]);

  const timeStr = formatTimeAgo(date);

  return (
    <span className={className}>
      {prefix}
      {timeStr}
      {suffix}
    </span>
  );
};
