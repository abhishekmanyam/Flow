import { useLocation } from "react-router-dom";
import { Kanban, Activity, Users, Settings, Zap, List as ListIcon, FileText, PenTool } from "lucide-react";
import PresenceAvatars from "./PresenceAvatars";
import type { Project, BoardPresence } from "@/lib/types";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Badge } from "@astryxdesign/core/Badge";
import { TabList, Tab } from "@astryxdesign/core/TabList";

interface ProjectHeaderProps {
  project: Project;
  workspaceSlug: string;
  canEdit: boolean;
  isProjectAdmin?: boolean;
  presenceUsers?: BoardPresence[];
  currentUserId?: string;
}

type ColorName = "purple" | "pink" | "orange" | "yellow" | "green" | "teal" | "blue" | "red";
const HEX_TO_COLOR: Record<string, ColorName> = {
  "#6366f1": "purple", "#8b5cf6": "purple", "#ec4899": "pink", "#f97316": "orange",
  "#eab308": "yellow", "#22c55e": "green", "#14b8a6": "teal", "#3b82f6": "blue",
  "#ef4444": "red", "#a855f7": "purple",
};
function colorName(hex: string): ColorName {
  return HEX_TO_COLOR[hex] ?? "blue";
}
function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function ProjectHeader({ project, workspaceSlug, canEdit, isProjectAdmin, presenceUsers, currentUserId }: ProjectHeaderProps) {
  const base = `/${workspaceSlug}/projects/${project.id}`;
  const showSettings = isProjectAdmin ?? canEdit;
  const location = useLocation();
  const tabs = [
    { id: "board", label: "Board", href: `${base}/board`, icon: Kanban },
    { id: "backlog", label: "Backlog", href: `${base}/backlog`, icon: ListIcon },
    { id: "epics", label: "Epics", href: `${base}/epics`, icon: Zap },
    { id: "activity", label: "Activity", href: `${base}/activity`, icon: Activity },
    { id: "members", label: "Members", href: `${base}/members`, icon: Users },
    { id: "notes", label: "Notes", href: `${base}/notes`, icon: FileText },
    { id: "whiteboard", label: "Whiteboard", href: `${base}/whiteboard`, icon: PenTool },
    ...(showSettings ? [{ id: "settings", label: "Settings", href: `${base}/settings`, icon: Settings }] : []),
  ];

  const active = tabs.find((t) => location.pathname.startsWith(t.href))?.id ?? "board";

  return (
    <VStack gap={0}>
      <HStack gap={2} align="center" justify="between" paddingInline={4} paddingBlock={3}>
        <HStack gap={2} align="center">
          <Badge variant={colorName(project.color)} label={initials(project.name)} />
          <Heading level={1} maxLines={1}>{project.name}</Heading>
        </HStack>
        {presenceUsers && presenceUsers.length > 0 && currentUserId && (
          <PresenceAvatars users={presenceUsers} currentUserId={currentUserId} />
        )}
      </HStack>
      <TabList value={active} onChange={() => {}} hasDivider size="sm">
        {tabs.map((tab) => (
          <Tab key={tab.id} value={tab.id} label={tab.label} href={tab.href} icon={<tab.icon size={14} />} />
        ))}
      </TabList>
    </VStack>
  );
}
