import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRINT_STATUS_LABELS } from "@/lib/types";
import type { Sprint } from "@/lib/types";

interface SprintPickerProps {
  sprints: Sprint[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}

export default function SprintPicker({ sprints, selectedId, onChange, disabled }: SprintPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = sprints.find((s) => s.id === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-accent",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {selected ? (
            <>
              <span className="truncate max-w-[140px]">{selected.name}</span>
              <Badge variant="secondary" className="text-[9px] px-1 py-0">
                {SPRINT_STATUS_LABELS[selected.status]}
              </Badge>
              {!disabled && (
                <X
                  className="h-3 w-3 opacity-50 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); onChange(null); }}
                />
              )}
            </>
          ) : (
            <span className="text-muted-foreground">No sprint</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search sprints..." />
          <CommandList>
            <CommandEmpty>No sprints found</CommandEmpty>
            <CommandGroup>
              {sprints.map((sprint) => (
                <CommandItem
                  key={sprint.id}
                  value={sprint.name}
                  onSelect={() => {
                    onChange(sprint.id === selectedId ? null : sprint.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selectedId === sprint.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{sprint.name}</span>
                  <Badge variant="secondary" className="ml-auto text-[9px] px-1 py-0">
                    {SPRINT_STATUS_LABELS[sprint.status]}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
