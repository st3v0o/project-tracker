import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { US_STATES } from "@/lib/constants";

interface StateComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
}

const ALL_OPTION = { value: "all", label: "All States" };

export function StateCombobox({ value, onValueChange }: StateComboboxProps) {
  const [open, setOpen] = useState(false);

  const displayLabel =
    value === "all" ? "All States" : (value || "All States");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="bg-background/50 rounded-xl w-full justify-between font-normal text-sm border-input h-9 px-3"
        >
          <span className={cn("truncate", value === "all" && "text-muted-foreground")}>
            {displayLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[220px]" align="start">
        <Command>
          <CommandInput placeholder="Type a state name..." className="h-9" />
          <CommandList>
            <CommandEmpty>No state found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={ALL_OPTION.value}
                onSelect={() => {
                  onValueChange("all");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "all" ? "opacity-100" : "opacity-0"
                  )}
                />
                {ALL_OPTION.label}
              </CommandItem>
              {US_STATES.map((state) => (
                <CommandItem
                  key={state}
                  value={state}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue === value ? "all" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === state ? "opacity-100" : "opacity-0"
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
  );
}
