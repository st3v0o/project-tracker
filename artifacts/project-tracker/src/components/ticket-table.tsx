import { useState } from "react";
import { format } from "date-fns";
import { MoreHorizontal, Edit, CheckCircle, Trash2, CalendarClock } from "lucide-react";
import type { Ticket } from "@workspace/api-client-react";
import { useTicketsManager } from "@/hooks/use-tickets-manager";
import { TicketStatusBadge } from "./ticket-status-badge";
import { TicketPriorityBadge } from "./ticket-priority-badge";
import { TimeSince } from "./time-since";
import { TicketFormDialog } from "./ticket-form-dialog";
import { TicketDetailDialog } from "./ticket-detail-dialog";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TicketTableProps {
  tickets: Ticket[];
  isLoading: boolean;
}

export function TicketTable({ tickets, isLoading }: TicketTableProps) {
  const { updateTicket, deleteTicket } = useTicketsManager();
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);

  const handleMarkComplete = async (ticket: Ticket) => {
    await updateTicket({
      id: ticket.id,
      data: {
        status: "complete",
        completedAt: new Date().toISOString()
      }
    });
  };

  const handleMarkPending = async (ticket: Ticket) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await updateTicket({
      id: ticket.id,
      data: {
        status: "pending",
        pendingDate: format(tomorrow, "yyyy-MM-dd")
      }
    });
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this ticket?")) {
      await deleteTicket({ id });
    }
  };

  if (isLoading) {
    return (
      <div className="w-full bg-card rounded-2xl border border-border/50 p-8 shadow-sm">
        <div className="space-y-4 animate-pulse">
          <div className="h-10 bg-muted/50 rounded-lg w-full"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-muted/30 rounded-lg w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="w-full bg-card rounded-2xl border border-border/50 p-16 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
          <ListTodo className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-display font-semibold text-foreground mb-2">No tickets found</h3>
        <p className="text-muted-foreground max-w-md">
          There are no tickets matching your current criteria. Create a new ticket to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[250px] font-medium text-foreground py-4">Ticket Details</TableHead>
                <TableHead className="font-medium text-foreground">State</TableHead>
                <TableHead className="font-medium text-foreground">Category</TableHead>
                <TableHead className="font-medium text-foreground">Status</TableHead>
                <TableHead className="font-medium text-foreground hidden sm:table-cell">Priority</TableHead>
                <TableHead className="font-medium text-foreground hidden md:table-cell">Submitted</TableHead>
                <TableHead className="font-medium text-foreground hidden lg:table-cell">Time Since</TableHead>
                <TableHead className="text-right font-medium text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="group hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setViewingTicket(ticket)}
                >
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground line-clamp-1" title={ticket.title}>
                        {ticket.title}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        By {ticket.submitter}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground font-normal">
                      {ticket.state}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{ticket.category}</span>
                  </TableCell>
                  <TableCell>
                    <TicketStatusBadge status={ticket.status as any} pendingDate={ticket.pendingDate} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <TicketPriorityBadge priority={ticket.priority ?? "medium"} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(ticket.submittedAt), "MMM d, yyyy")}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <TimeSince 
                      dateString={ticket.submittedAt} 
                      className="text-sm font-medium text-foreground bg-background px-2 py-1 rounded-md border shadow-sm inline-block"
                    />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {ticket.status !== "complete" && (
                          <DropdownMenuItem onClick={() => handleMarkComplete(ticket)} className="text-success cursor-pointer">
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark Complete
                          </DropdownMenuItem>
                        )}
                        {ticket.status !== "pending" && ticket.status !== "complete" && (
                          <DropdownMenuItem onClick={() => handleMarkPending(ticket)} className="text-warning cursor-pointer">
                            <CalendarClock className="mr-2 h-4 w-4" />
                            Carry over to Tomorrow
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setEditingTicket(ticket)} className="cursor-pointer">
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Ticket
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(ticket.id)} className="text-destructive cursor-pointer">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <TicketDetailDialog
        ticket={viewingTicket}
        open={!!viewingTicket}
        onOpenChange={(open) => !open && setViewingTicket(null)}
      />

      <TicketFormDialog 
        ticket={editingTicket || undefined} 
        open={!!editingTicket} 
        onOpenChange={(open) => !open && setEditingTicket(null)} 
      />
    </>
  );
}

import { ListTodo } from "lucide-react";
