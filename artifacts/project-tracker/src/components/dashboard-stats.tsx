import { motion } from "framer-motion";
import { CheckCircle2, Clock, ListTodo, Layers } from "lucide-react";
import type { Ticket } from "@workspace/api-client-react";
import { isBefore, startOfToday, parseISO } from "date-fns";

interface DashboardStatsProps {
  tickets: Ticket[];
}

export function DashboardStats({ tickets }: DashboardStatsProps) {
  const total = tickets.length;
  const todo = tickets.filter(t => t.status === "todo").length;
  const complete = tickets.filter(t => t.status === "complete").length;
  
  // Calculate overdue pending separately for a more nuanced stat
  let pendingNormal = 0;
  let pendingOverdue = 0;

  tickets.forEach(t => {
    if (t.status === "pending") {
      if (t.pendingDate && isBefore(parseISO(t.pendingDate), startOfToday())) {
        pendingOverdue++;
      } else {
        pendingNormal++;
      }
    }
  });

  const stats = [
    {
      title: "Total Tickets",
      value: total,
      icon: Layers,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "To Do (Today)",
      value: todo,
      icon: ListTodo,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Pending",
      value: pendingNormal + pendingOverdue,
      subValue: pendingOverdue > 0 ? `${pendingOverdue} Overdue` : undefined,
      icon: Clock,
      color: pendingOverdue > 0 ? "text-destructive" : "text-warning",
      bgColor: pendingOverdue > 0 ? "bg-destructive/10" : "bg-warning/10",
      subColor: "text-destructive font-medium",
    },
    {
      title: "Completed",
      value: complete,
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10",
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4, ease: "easeOut" }}
            className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden group"
          >
            <div className="flex justify-between items-start z-10 relative">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-display font-bold text-foreground">{stat.value}</h3>
                  {stat.subValue && (
                    <span className={`text-xs ${stat.subColor}`}>{stat.subValue}</span>
                  )}
                </div>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor} ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            
            {/* Decorative background blur */}
            <div className={`absolute -bottom-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-20 ${stat.bgColor} pointer-events-none`} />
          </motion.div>
        );
      })}
    </div>
  );
}
