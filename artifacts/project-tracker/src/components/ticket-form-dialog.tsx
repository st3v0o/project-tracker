import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, ChevronsUpDown, Check, ImageIcon, Loader2, X, Sparkles, Camera } from "lucide-react";
import { useTicketsManager } from "@/hooks/use-tickets-manager";
import { US_STATES, CATEGORIES, PRIORITIES } from "@/lib/constants";
import type { Ticket } from "@workspace/api-client-react";
import { CameraCapture, isCameraAvailable } from "./camera-capture";

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
import { Badge } from "@/components/ui/badge";
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
  priority: z.enum(["low", "medium", "high", "critical"]),
  pendingDate: z.date().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface TicketFormDialogProps {
  ticket?: Ticket;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ParsedFields {
  title?: string | null;
  description?: string | null;
  submitter?: string | null;
  state?: string | null;
  category?: string | null;
  confidence?: string | null;
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result, mimeType: file.type || "image/png" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const BASE_URL = import.meta.env.BASE_URL ?? "/";

async function parseImage(base64: string, mimeType: string): Promise<ParsedFields> {
  const url = `${BASE_URL}api/tickets/parse-image`.replace("//", "/");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? "Failed to parse image");
  }
  return res.json();
}

export function TicketFormDialog({ ticket, trigger, open: controlledOpen, onOpenChange }: TicketFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [statePopoverOpen, setStatePopoverOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const [isDragging, setIsDragging] = useState(false);
  const [isParsingImage, setIsParsingImage] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraSupported = isCameraAvailable();

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
      priority: "medium",
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
        priority: (ticket.priority ?? "medium") as any,
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
        priority: "medium",
        pendingDate: null,
      });
      setPreviewUrl(null);
      setConfidence(null);
      setParseError(null);
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
      setPreviewUrl(null);
      setConfidence(null);
      setParseError(null);
      setShowCamera(false);
    }
  };

  const handleCameraCapture = useCallback(async (dataUrl: string, mimeType: string) => {
    setShowCamera(false);
    setIsParsingImage(true);
    setParseError(null);
    setConfidence(null);
    setPreviewUrl(dataUrl);

    try {
      const fields = await parseImage(dataUrl, mimeType);
      if (fields.title) form.setValue("title", fields.title, { shouldValidate: true });
      if (fields.description) form.setValue("description", fields.description, { shouldValidate: true });
      if (fields.submitter) form.setValue("submitter", fields.submitter, { shouldValidate: true });
      if (fields.state) {
        const matched = US_STATES.find((s) => s.toLowerCase() === fields.state!.toLowerCase());
        if (matched) form.setValue("state", matched, { shouldValidate: true });
      }
      if (fields.category) {
        const matched = CATEGORIES.find((c) => c.toLowerCase() === fields.category!.toLowerCase());
        if (matched) form.setValue("category", matched, { shouldValidate: true });
      }
      if (fields.confidence) setConfidence(fields.confidence);
    } catch (err: any) {
      setParseError(err.message ?? "Failed to analyze image.");
    } finally {
      setIsParsingImage(false);
    }
  }, [form]);

  const processImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setParseError("Please provide an image file.");
      return;
    }
    setIsParsingImage(true);
    setParseError(null);
    setConfidence(null);

    try {
      const { base64, mimeType } = await fileToBase64(file);
      setPreviewUrl(base64);
      const fields = await parseImage(base64, mimeType);

      if (fields.title) form.setValue("title", fields.title, { shouldValidate: true });
      if (fields.description) form.setValue("description", fields.description, { shouldValidate: true });
      if (fields.submitter) form.setValue("submitter", fields.submitter, { shouldValidate: true });
      if (fields.state) {
        const matchedState = US_STATES.find(
          (s) => s.toLowerCase() === fields.state!.toLowerCase()
        );
        if (matchedState) form.setValue("state", matchedState, { shouldValidate: true });
      }
      if (fields.category) {
        const matchedCat = CATEGORIES.find(
          (c) => c.toLowerCase() === fields.category!.toLowerCase()
        );
        if (matchedCat) form.setValue("category", matchedCat, { shouldValidate: true });
      }
      if (fields.confidence) setConfidence(fields.confidence);
    } catch (err: any) {
      setParseError(err.message ?? "Failed to analyze image.");
    } finally {
      setIsParsingImage(false);
    }
  }, [form]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processImageFile(file);
  }, [processImageFile]);

  // Document-level paste listener — active whenever the dialog is open
  // so Ctrl+V works regardless of which element has focus.
  // Only intercepts paste events that contain an image; text pastes into
  // inputs are left alone.
  useEffect(() => {
    if (!open || isEditMode) return;

    const handleDocumentPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) processImageFile(file);
    };

    document.addEventListener("paste", handleDocumentPaste);
    return () => document.removeEventListener("paste", handleDocumentPaste);
  }, [open, isEditMode, processImageFile]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = "";
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
            priority: data.priority,
            pendingDate: formattedPendingDate,
            completedAt,
          }
        });
      } else {
        await createTicket({
          data: {
            title: data.title,
            description: data.description,
            state: data.state,
            submitter: data.submitter,
            category: data.category,
            status: data.status,
            priority: data.priority,
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
      <DialogContent className="sm:max-w-[620px] overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">{isEditMode ? "Edit Ticket" : "Create New Ticket"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Make changes to the ticket details below." : "Fill in the details to track a new piece of work."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">

            {/* AI Image Drop Zone — only shown for new tickets */}
            {!isEditMode && (
              <div className="space-y-2">
                {/* Camera live view */}
                {showCamera && (
                  <CameraCapture
                    onCapture={handleCameraCapture}
                    onClose={() => setShowCamera(false)}
                  />
                )}

                <div
                  ref={dropZoneRef}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "relative rounded-xl border-2 border-dashed transition-all duration-200",
                    !showCamera && !isParsingImage && !previewUrl && "cursor-pointer",
                    isDragging
                      ? "border-primary bg-primary/10 scale-[1.01]"
                      : "border-border/60 bg-muted/30 hover:border-primary/60 hover:bg-muted/50"
                  )}
                  onClick={() => !isParsingImage && !showCamera && !previewUrl && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  {previewUrl ? (
                    <div className="p-3 flex items-start gap-3">
                      <img
                        src={previewUrl}
                        alt="Uploaded screenshot"
                        className="h-20 w-20 object-cover rounded-lg border border-border/40 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm font-medium text-foreground">
                            {isParsingImage ? "Analyzing image..." : "Fields auto-filled from image"}
                          </span>
                          {!isParsingImage && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewUrl(null);
                                setConfidence(null);
                                setParseError(null);
                              }}
                              className="ml-auto text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {isParsingImage && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Reading image with AI...</span>
                          </div>
                        )}
                        {confidence && !isParsingImage && (
                          <Badge variant="secondary" className="text-xs">
                            Confidence: {confidence}
                          </Badge>
                        )}
                        {parseError && !isParsingImage && (
                          <p className="text-xs text-destructive mt-1">{parseError}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-5 px-4 text-center">
                      {isParsingImage ? (
                        <>
                          <Loader2 className="h-7 w-7 text-primary animate-spin" />
                          <p className="text-sm text-muted-foreground">Analyzing your image with AI...</p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
                            <Sparkles className="h-4 w-4 text-primary/60" />
                          </div>
                          <p className="text-sm font-medium text-foreground">Drop or paste a screenshot to auto-fill</p>
                          <p className="text-xs text-muted-foreground">
                            Paste (Ctrl+V) · Drag &amp; drop · or click to browse
                          </p>
                          {cameraSupported && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowCamera(true);
                              }}
                              className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary/80 hover:text-primary transition-colors"
                            >
                              <Camera className="h-3.5 w-3.5" />
                              Take Photo
                            </button>
                          )}
                          {parseError && (
                            <p className="text-xs text-destructive">{parseError}</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
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
              <Button type="submit" disabled={isPending || isParsingImage}>
                {isPending ? "Saving..." : isEditMode ? "Save Changes" : "Create Ticket"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
