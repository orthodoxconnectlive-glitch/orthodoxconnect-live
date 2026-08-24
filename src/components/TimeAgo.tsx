import React, { useState, useEffect } from 'react';
import { formatTimeAgo } from '../utils/timeAgo';
import { useTheme } from '../context/ThemeContext';

interface TimeAgoProps {
  date?: string | Date | number;
  dateString?: string;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export const TimeAgo: React.FC<TimeAgoProps> = ({
  date,
  dateString,
  className = '',
  prefix = '',
  suffix = '',
}) => {
  const { language } = useTheme();
  const [, setTick] = useState(0);

  useEffect(() => {
    // Re-render every 15 seconds so relative times transition smoothly
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, [date, dateString]);

  const targetDate = date || dateString;
  const timeStr = formatTimeAgo(targetDate, language);

  return (
    <span className={className}>
      {prefix}
      {timeStr}
      {suffix}
    </span>
  );
};
