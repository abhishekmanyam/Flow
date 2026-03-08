import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Epic } from "@/lib/types";

interface EpicPickerProps {
  epics: Epic[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}

export default function EpicPicker({ epics, selectedId, onChange, disabled }: EpicPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = epics.find((e) => e.id === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 justify-start text-sm font-normal" disabled={disabled}>
          {selected ? (
            <span className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
              <span className="truncate">{selected.title}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />Epic
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search epics..." />
          <CommandList>
            <CommandEmpty>No epics found.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => { onChange(null); setOpen(false); }} className="flex items-center gap-2">
                <span className="flex-1">No epic</span>
                <Check className={cn("h-3.5 w-3.5", !selectedId ? "opacity-100" : "opacity-0")} />
              </CommandItem>
              {epics.map((epic) => (
                <CommandItem key={epic.id} onSelect={() => { onChange(epic.id); setOpen(false); }} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: epic.color }} />
                  <span className="flex-1 truncate">{epic.title}</span>
                  <Check className={cn("h-3.5 w-3.5", selectedId === epic.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
