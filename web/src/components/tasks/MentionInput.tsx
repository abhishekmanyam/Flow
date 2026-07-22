import { useState, useRef, useEffect } from "react";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Popover } from "@astryxdesign/core/Popover";
import { List, ListItem } from "@astryxdesign/core/List";
import { Avatar } from "@astryxdesign/core/Avatar";
import type { WorkspaceMember } from "@/lib/types";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  members: WorkspaceMember[];
  placeholder?: string;
  className?: string;
}

export default function MentionInput({ value, onChange, onKeyDown, members, placeholder }: MentionInputProps) {
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredMembers = members.filter((m) => {
    const name = m.profile?.name ?? "";
    return name.toLowerCase().includes(mentionQuery.toLowerCase());
  });

  const handleInputChange = (val: string, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(val);

    const cursorPos = e.target.selectionStart ?? val.length;
    const beforeCursor = val.slice(0, cursorPos);
    const lastAt = beforeCursor.lastIndexOf("@");

    if (lastAt !== -1) {
      const charBefore = lastAt > 0 ? beforeCursor[lastAt - 1] : " ";
      if (charBefore === " " || lastAt === 0) {
        const query = beforeCursor.slice(lastAt + 1);
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
    setTimeout(() => {
      inputRef.current?.focus();
      const pos = before.length + name.length + 2;
      inputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  // Forward the host's onKeyDown (e.g. Enter-to-send) from the textarea element.
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !onKeyDown) return;
    const handler = (e: KeyboardEvent) => {
      if (mentionOpen && (e.key === "Escape" || e.key === "Enter")) return;
      onKeyDown(e as unknown as React.KeyboardEvent<HTMLInputElement>);
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [onKeyDown, mentionOpen]);

  // Close suggestions on escape.
  useEffect(() => {
    if (!mentionOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMentionOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mentionOpen]);

  return (
    <>
      <TextArea
        ref={inputRef}
        label="Comment"
        isLabelHidden
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        rows={2}
      />
      <Popover
        anchorRef={inputRef as React.RefObject<HTMLElement>}
        content={
          <List density="compact" hasDividers>
            {filteredMembers.map((m) => (
              <ListItem
                key={m.userId}
                label={m.profile?.name ?? "Unknown"}
                startContent={<Avatar size="xsmall" name={m.profile?.name ?? undefined} src={m.profile?.avatarUrl ?? undefined} />}
                onClick={() => selectMember(m.profile?.name ?? "Unknown")}
              />
            ))}
          </List>
        }
        isOpen={mentionOpen && filteredMembers.length > 0}
        onOpenChange={setMentionOpen}
        placement="above"
        alignment="start"
        hasAutoFocus={false}
        width={224}
      />
    </>
  );
}
