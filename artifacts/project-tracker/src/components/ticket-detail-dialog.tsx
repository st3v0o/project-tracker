import { format } from "date-fns";
import { Edit, Calendar, MapPin, Tag, User, FileText, Clock } from "lucide-react";
import type { Ticket } from "@workspace/api-client-react";
import { TicketStatusBadge } from "./ticket-status-badge";
import { TicketPriorityBadge } from "./ticket-priority-badge";
import { TimeSince } from "./time-since";
import { TicketFormDialog } from "./ticket-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface TicketDetailDialogProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

export function TicketDetailDialog({ ticket, open, onOpenChange }: TicketDetailDialogProps) {
  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] gap-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-6">
              <DialogTitle className="text-lg font-semibold leading-snug text-foreground">
                {ticket.title}
              </DialogTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <TicketStatusBadge status={ticket.status as any} pendingDate={ticket.pendingDate} />
              <TicketPriorityBadge priority={ticket.priority ?? "medium"} />
              <Badge variant="secondary" className="bg-secondary/50 font-normal">
                {ticket.state}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        <Separator />

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <Field icon={User} label="Submitted by">
            {ticket.submitter}
          </Field>

          <Field icon={Tag} label="Category">
            {ticket.category}
          </Field>

          <Field icon={MapPin} label="State">
            {ticket.state}
          </Field>

          <Field icon={Calendar} label="Submitted">
            {format(new Date(ticket.submittedAt), "MMMM d, yyyy 'at' h:mm a")}
          </Field>

          <Field icon={Clock} label="Time since submission">
            <TimeSince
              dateString={ticket.submittedAt}
              className="font-medium"
            />
          </Field>

          {ticket.pendingDate && (
            <Field icon={Calendar} label="Pending until">
              {format(new Date(ticket.pendingDate + "T00:00:00"), "MMMM d, yyyy")}
            </Field>
          )}

          {ticket.completedAt && (
            <Field icon={Calendar} label="Completed">
              {format(new Date(ticket.completedAt), "MMMM d, yyyy 'at' h:mm a")}
            </Field>
          )}

          {ticket.description && (
            <Field icon={FileText} label="Description">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {ticket.description}
              </p>
            </Field>
          )}
        </div>

        <Separator />

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-2 bg-muted/20">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <TicketFormDialog
            ticket={ticket}
            trigger={
              <Button>
                <Edit className="w-4 h-4 mr-2" />
                Edit Ticket
              </Button>
            }
            onOpenChange={(open) => {
              if (!open) onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
