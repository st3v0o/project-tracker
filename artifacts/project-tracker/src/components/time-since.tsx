import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

interface TimeSinceProps {
  dateString: string;
  className?: string;
}

export function TimeSince({ dateString, className }: TimeSinceProps) {
  const [timeAgo, setTimeAgo] = useState("");

  useEffect(() => {
    // Initial calculation
    const updateTime = () => {
      try {
        const date = new Date(dateString);
        setTimeAgo(formatDistanceToNow(date, { addSuffix: true }));
      } catch (e) {
        setTimeAgo("Unknown");
      }
    };

    updateTime();

    // Update every minute
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, [dateString]);

  if (!timeAgo) return <span className="opacity-0">Loading...</span>;

  return <span className={className}>{timeAgo}</span>;
}
