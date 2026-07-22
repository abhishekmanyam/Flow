import { useState } from "react";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Selector } from "@astryxdesign/core/Selector";
import { DateInput } from "@astryxdesign/core/DateInput";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp as TimestampText } from "@astryxdesign/core/Timestamp";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { parseLocalDate } from "@/lib/date-utils";
import { format } from "date-fns";
import { TASK_PRIORITY_LABELS } from "@/lib/types";
import PriorityIcon from "./PriorityIcon";
import type { Subtask, WorkspaceMember, TaskPriority } from "@/lib/types";
import type { Timestamp as FsTimestamp } from "firebase/firestore";
import type { ISODateString } from "@astryxdesign/core/Calendar";

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

interface SubtaskRowProps {
  subtask: Subtask;
  members: WorkspaceMember[];
  canEdit: boolean;
  onToggle: () => void;
  onUpdate: (changes: Partial<Subtask>) => void;
  onDelete: () => void;
}

export default function SubtaskRow({ subtask, members, canEdit, onToggle, onUpdate, onDelete }: SubtaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(subtask.title);

  const handleTitleSave = () => {
    if (!titleDraft.trim() || titleDraft === subtask.title) { setEditingTitle(false); return; }
    onUpdate({ title: titleDraft.trim() });
    setEditingTitle(false);
  };

  const dueDate = tsToDate(subtask.dueDate);
  const closed = subtask.status === "closed";

  return (
    <VStack gap={0}>
      <HStack gap={2} align="center">
        {canEdit && (
          <IconButton
            label={expanded ? "Collapse" : "Expand"}
            variant="ghost"
            size="sm"
            icon={expanded ? <ChevronDown /> : <ChevronRight />}
            onClick={() => setExpanded(!expanded)}
          />
        )}
        <CheckboxInput label="Toggle subtask" isLabelHidden value={closed} onChange={() => onToggle()} isDisabled={!canEdit} />
        <HStack width="fill" align="center">
          {editingTitle && canEdit ? (
            <TextInput
              label="Subtask title"
              isLabelHidden
              size="sm"
              value={titleDraft}
              onChange={setTitleDraft}
              hasAutoFocus
            />
          ) : canEdit ? (
            <Button label={subtask.title} variant="ghost" size="sm" onClick={() => { setTitleDraft(subtask.title); setEditingTitle(true); }}>
              <Text type="body" color={closed ? "disabled" : "primary"} hasStrikethrough={closed} maxLines={1}>
                {subtask.title}
              </Text>
            </Button>
          ) : (
            <Text type="body" color={closed ? "disabled" : "primary"} hasStrikethrough={closed} maxLines={1}>
              {subtask.title}
            </Text>
          )}
        </HStack>
        {subtask.priority !== "none" && <PriorityIcon priority={subtask.priority} />}
        {dueDate && <TimestampText value={dueDate.toISOString()} format="date" />}
        {canEdit && (
          <IconButton label="Delete subtask" tooltip="Delete" variant="ghost" size="sm" icon={<Trash2 />} onClick={onDelete} />
        )}
      </HStack>

      {editingTitle && canEdit && (
        <HStack gap={2} paddingBlock={1}>
          <Button label="Save" variant="primary" size="sm" onClick={handleTitleSave} />
          <Button label="Cancel" variant="ghost" size="sm" onClick={() => setEditingTitle(false)} />
        </HStack>
      )}

      {expanded && canEdit && (
        <VStack paddingBlock={2} paddingInline={4}>
          <FormLayout direction="horizontal">
            <Selector
              label="Priority"
              value={subtask.priority}
              onChange={(v) => onUpdate({ priority: v as TaskPriority })}
              options={(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => ({ value: v, label: l }))}
              size="sm"
            />
            <Selector
              label="Assignee"
              placeholder="Unassigned"
              value={subtask.assigneeId ?? "unassigned"}
              onChange={(v) => onUpdate({ assigneeId: v === "unassigned" ? null : v })}
              options={[
                { value: "unassigned", label: "Unassigned" },
                ...members.map((m) => ({ value: m.userId, label: m.profile?.name ?? "Unknown" })),
              ]}
              size="sm"
            />
            <DateInput
              label="Due date"
              value={dueDate ? (format(dueDate, "yyyy-MM-dd") as ISODateString) : undefined}
              onChange={(v) => onUpdate({ dueDate: v ? (parseLocalDate(v) as unknown as FsTimestamp) : null })}
              size="sm"
              hasClear
            />
          </FormLayout>
        </VStack>
      )}
    </VStack>
  );
}
