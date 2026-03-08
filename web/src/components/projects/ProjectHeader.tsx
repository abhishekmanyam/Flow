import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Kanban, Activity, Users, Settings, Zap, List, FileText, PenTool } from "lucide-react";
import PresenceAvatars from "./PresenceAvatars";
import type { Project, BoardPresence } from "@/lib/types";

interface ProjectHeaderProps {
  project: Project;
  workspaceSlug: string;
  canEdit: boolean;
  isProjectAdmin?: boolean;
  presenceUsers?: BoardPresence[];
  currentUserId?: string;
}

export default function ProjectHeader({ project, workspaceSlug, canEdit, isProjectAdmin, presenceUsers, currentUserId }: ProjectHeaderProps) {
  const base = `/${workspaceSlug}/projects/${project.id}`;
  const showSettings = isProjectAdmin ?? canEdit;
  const tabs = [
    { id: "board", label: "Board", href: `${base}/board`, icon: Kanban },
    { id: "backlog", label: "Backlog", href: `${base}/backlog`, icon: List },
    { id: "epics", label: "Epics", href: `${base}/epics`, icon: Zap },
    { id: "activity", label: "Activity", href: `${base}/activity`, icon: Activity },
    { id: "members", label: "Members", href: `${base}/members`, icon: Users },
    { id: "notes", label: "Notes", href: `${base}/notes`, icon: FileText },
    { id: "whiteboard", label: "Whiteboard", href: `${base}/whiteboard`, icon: PenTool },
    ...(showSettings ? [{ id: "settings", label: "Settings", href: `${base}/settings`, icon: Settings }] : []),
  ];
  return (
    <div className="border-b bg-background">
      <div className="px-6 pt-4 pb-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
          <h1 className="font-semibold text-lg">{project.name}</h1>
          {presenceUsers && presenceUsers.length > 0 && currentUserId && (
            <div className="ml-auto">
              <PresenceAvatars users={presenceUsers} currentUserId={currentUserId} />
            </div>
          )}
        </div>
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <NavLink key={tab.id} to={tab.href}
              className={({ isActive }) => cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              )}>
              <tab.icon className="h-3.5 w-3.5" />{tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
