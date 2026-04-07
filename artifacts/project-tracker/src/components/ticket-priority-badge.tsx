import { Badge } from "@/components/ui/badge";
import type { Priority } from "@/lib/constants";

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  low: {
    label: "Low",
    className: "bg-secondary/60 text-secondary-foreground border-secondary/40",
  },
  medium: {
    label: "Medium",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  },
  high: {
    label: "High",
    className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  },
  critical: {
    label: "Critical",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
};

interface TicketPriorityBadgeProps {
  priority: string;
}

export function TicketPriorityBadge({ priority }: TicketPriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority as Priority] ?? PRIORITY_CONFIG.medium;
  return (
    <Badge variant="outline" className={`font-medium text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
}
