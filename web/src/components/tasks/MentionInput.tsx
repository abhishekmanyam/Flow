import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Command, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import type { WorkspaceMember } from "@/lib/types";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  members: WorkspaceMember[];
  placeholder?: string;
  className?: string;
}

export default function MentionInput({ value, onChange, onKeyDown, members, placeholder, className }: MentionInputProps) {
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredMembers = members.filter((m) => {
    const name = m.profile?.name ?? "";
    return name.toLowerCase().includes(mentionQuery.toLowerCase());
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    const cursorPos = e.target.selectionStart ?? val.length;
    // Find the last @ before cursor
    const beforeCursor = val.slice(0, cursorPos);
    const lastAt = beforeCursor.lastIndexOf("@");

    if (lastAt !== -1) {
      // Check that @ is at start or preceded by whitespace
      const charBefore = lastAt > 0 ? beforeCursor[lastAt - 1] : " ";
      if (charBefore === " " || lastAt === 0) {
        const query = beforeCursor.slice(lastAt + 1);
        // Only show if no space after @ (user is still typing the name)
        if (!query.includes(" ") || query.length <= 20) {
          setMentionQuery(query);
          setMentionStart(lastAt);
          setMentionOpen(true);
          return;
        }
      }
    }
    setMentionOpen(false);
  };

  const selectMember = (name: string) => {
    if (mentionStart === -1) return;
    const before = value.slice(0, mentionStart);
    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const after = value.slice(cursorPos);
    const newValue = `${before}@${name} ${after}`;
    onChange(newValue);
    setMentionOpen(false);
    // Refocus input
    setTimeout(() => {
      inputRef.current?.focus();
      const pos = before.length + name.length + 2;
      inputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  // Close on escape
  useEffect(() => {
    if (!mentionOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMentionOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mentionOpen]);

  return (
    <Popover open={mentionOpen && filteredMembers.length > 0} onOpenChange={setMentionOpen}>
      <PopoverAnchor asChild>
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          className={className}
        />
      </PopoverAnchor>
      <PopoverContent className="p-0 w-56" align="start" side="top" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command>
          <CommandList>
            <CommandEmpty>No members found</CommandEmpty>
            {filteredMembers.map((m) => (
              <CommandItem
                key={m.userId}
                onSelect={() => selectMember(m.profile?.name ?? "Unknown")}
                className="cursor-pointer"
              >
                {m.profile?.name ?? "Unknown"}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
