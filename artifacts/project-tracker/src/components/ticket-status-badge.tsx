import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, CircleDashed, AlertCircle } from "lucide-react";
import { isBefore, startOfToday, parseISO } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TicketStatusBadgeProps {
  status: "todo" | "pending" | "complete";
  pendingDate?: string | null;
  className?: string;
}

export function TicketStatusBadge({ status, pendingDate, className }: TicketStatusBadgeProps) {
  const isOverduePending = 
    status === "pending" && 
    pendingDate && 
    isBefore(parseISO(pendingDate), startOfToday());

  if (status === "complete") {
    return (
      <Badge variant="outline" className={cn("bg-success/15 text-success hover:bg-success/25 border-success/20", className)}>
        <CheckCircle2 className="w-3 h-3 mr-1.5" />
        Complete
      </Badge>
    );
  }

  if (status === "pending") {
    if (isOverduePending) {
      return (
        <Badge variant="outline" className={cn("bg-destructive/15 text-destructive hover:bg-destructive/25 border-destructive/20", className)}>
          <AlertCircle className="w-3 h-3 mr-1.5" />
          Overdue Pending
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={cn("bg-warning/15 text-warning hover:bg-warning/25 border-warning/20", className)}>
        <Clock className="w-3 h-3 mr-1.5" />
        Pending
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn("bg-primary/10 text-primary hover:bg-primary/20 border-primary/20", className)}>
      <CircleDashed className="w-3 h-3 mr-1.5" />
      To Do
    </Badge>
  );
}
