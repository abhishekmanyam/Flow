import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/types";
import type { TaskFilters } from "@/hooks/useTaskFilters";
import type { WorkspaceMember, Label, Epic, Sprint, TaskStatus, TaskPriority } from "@/lib/types";

interface TaskFilterBarProps {
  filters: TaskFilters;
  hasActiveFilters: boolean;
  members: WorkspaceMember[];
  labels: Label[];
  epics: Epic[];
  sprints: Sprint[];
  onUpdateFilter: <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => void;
  onClear: () => void;
}

function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (values: T[]) => void;
}) {
  const toggle = (value: T) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">{selected.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt.value} value={opt.label} onSelect={() => toggle(opt.value)}>
                  <Check className={cn("mr-2 h-4 w-4", selected.includes(opt.value) ? "opacity-100" : "opacity-0")} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SingleSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          {label}
          {selected && <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">1</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt.value} value={opt.label} onSelect={() => onChange(selected === opt.value ? null : opt.value)}>
                  <Check className={cn("mr-2 h-4 w-4", selected === opt.value ? "opacity-100" : "opacity-0")} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function TaskFilterBar({
  filters, hasActiveFilters, members, labels, epics, sprints, onUpdateFilter, onClear,
}: TaskFilterBarProps) {
  const statusOptions = (Object.entries(TASK_STATUS_LABELS) as [TaskStatus, string][]).map(([v, l]) => ({ value: v, label: l }));
  const priorityOptions = (Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => ({ value: v, label: l }));
  const assigneeOptions = members.map((m) => ({ value: m.userId, label: m.profile?.name ?? "Unknown" }));
  const labelOptions = labels.map((l) => ({ value: l.id, label: l.name }));
  const epicOptions = epics.map((e) => ({ value: e.id, label: e.title }));
  const sprintOptions = sprints.map((s) => ({ value: s.id, label: s.name }));
  const dueDateOptions: { value: "overdue" | "today" | "this_week" | "no_date"; label: string }[] = [
    { value: "overdue", label: "Overdue" },
    { value: "today", label: "Due today" },
    { value: "this_week", label: "This week" },
    { value: "no_date", label: "No date" },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
      <MultiSelectFilter label="Status" options={statusOptions} selected={filters.status} onChange={(v) => onUpdateFilter("status", v)} />
      <MultiSelectFilter label="Priority" options={priorityOptions} selected={filters.priority} onChange={(v) => onUpdateFilter("priority", v)} />
      {assigneeOptions.length > 0 && (
        <MultiSelectFilter label="Assignee" options={assigneeOptions} selected={filters.assigneeIds} onChange={(v) => onUpdateFilter("assigneeIds", v)} />
      )}
      {labelOptions.length > 0 && (
        <MultiSelectFilter label="Labels" options={labelOptions} selected={filters.labelIds} onChange={(v) => onUpdateFilter("labelIds", v)} />
      )}
      {epicOptions.length > 0 && (
        <SingleSelectFilter label="Epic" options={epicOptions} selected={filters.epicId} onChange={(v) => onUpdateFilter("epicId", v)} />
      )}
      {sprintOptions.length > 0 && (
        <SingleSelectFilter label="Sprint" options={sprintOptions} selected={filters.sprintId} onChange={(v) => onUpdateFilter("sprintId", v)} />
      )}
      <SingleSelectFilter label="Due date" options={dueDateOptions} selected={filters.dueDateRange} onChange={(v) => onUpdateFilter("dueDateRange", v)} />
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onClear}>
          <X className="h-3 w-3" />Clear
        </Button>
      )}
    </div>
  );
}
