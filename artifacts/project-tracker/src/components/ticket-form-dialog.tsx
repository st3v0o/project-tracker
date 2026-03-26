import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, ChevronsUpDown, Check } from "lucide-react";
import { useTicketsManager } from "@/hooks/use-tickets-manager";
import { US_STATES, CATEGORIES } from "@/lib/constants";
import type { Ticket } from "@workspace/api-client-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  state: z.string().min(1, "State is required"),
  submitter: z.string().min(1, "Submitter is required"),
  category: z.string().min(1, "Category is required"),
  status: z.enum(["todo", "pending", "complete"]),
  pendingDate: z.date().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface TicketFormDialogProps {
  ticket?: Ticket;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TicketFormDialog({ ticket, trigger, open: controlledOpen, onOpenChange }: TicketFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [statePopoverOpen, setStatePopoverOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const { createTicket, updateTicket, isCreating, isUpdating } = useTicketsManager();
  const isEditMode = !!ticket;
  const isPending = isCreating || isUpdating;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      state: "",
      submitter: "",
      category: "",
      status: "todo",
      pendingDate: null,
    },
  });

  const watchStatus = form.watch("status");

  useEffect(() => {
    if (open && ticket) {
      form.reset({
        title: ticket.title,
        description: ticket.description,
        state: ticket.state,
        submitter: ticket.submitter,
        category: ticket.category,
        status: ticket.status as any,
        pendingDate: ticket.pendingDate ? new Date(ticket.pendingDate) : null,
      });
    } else if (open && !ticket) {
      form.reset({
        title: "",
        description: "",
        state: "",
        submitter: "",
        category: "",
        status: "todo",
        pendingDate: null,
      });
    }
  }, [open, ticket, form]);

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled && onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
    if (!newOpen) {
      form.reset();
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const formattedPendingDate = data.pendingDate ? format(data.pendingDate, "yyyy-MM-dd") : null;

      if (isEditMode && ticket) {
        const completedAt = data.status === "complete" && ticket.status !== "complete"
          ? new Date().toISOString()
          : ticket.completedAt;

        await updateTicket({
          id: ticket.id,
          data: {
            title: data.title,
            description: data.description,
            state: data.state,
            submitter: data.submitter,
            category: data.category,
            status: data.status,
            pendingDate: formattedPendingDate,
            completedAt,
          }
        });
      } else {
        // Don't send submittedAt — server defaults to now()
        await createTicket({
          data: {
            title: data.title,
            description: data.description,
            state: data.state,
            submitter: data.submitter,
            category: data.category,
            status: data.status,
          }
        });
      }
      handleOpenChange(false);
    } catch (error) {
      console.error("Form submission error", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">{isEditMode ? "Edit Ticket" : "Create New Ticket"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Make changes to the ticket details below." : "Fill in the details to track a new piece of work."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g., Map Integration Fix" className="bg-background/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="submitter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Submitter Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" className="bg-background/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* State — searchable combobox */}
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <Popover open={statePopoverOpen} onOpenChange={setStatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={statePopoverOpen}
                            className={cn(
                              "w-full justify-between bg-background/50 font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value || "Select or type a state..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search state..." />
                          <CommandList className="max-h-60 overflow-y-auto">
                            <CommandEmpty>No state found.</CommandEmpty>
                            <CommandGroup>
                              {US_STATES.map((state) => (
                                <CommandItem
                                  key={state}
                                  value={state}
                                  onSelect={(val) => {
                                    field.onChange(val);
                                    setStatePopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === state ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {state}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="todo">To Do (Today)</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchStatus === "pending" && (
                <FormField
                  control={form.control}
                  name="pendingDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col mt-2">
                      <FormLabel>Pending Until Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal bg-background/50",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Provide details about this task..."
                        className="resize-none min-h-[100px] bg-background/50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4 border-t border-border/40">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditMode ? "Save Changes" : "Create Ticket"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
