import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { subscribeToAccessibleProjects } from "@/lib/firestore";
import {
  LayoutDashboard, FolderKanban, Users, Settings,
  LogOut, ChevronDown, Plus, Clock, CalendarDays,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { Project } from "@/lib/types";
import NotificationBell from "@/components/notifications/NotificationBell";

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(/\s/).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("");
}

export default function Sidebar() {
  const { workspace, role, user, signOut } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!workspace || !user || !role) return;
    return subscribeToAccessibleProjects(workspace.id, user.uid, role, setProjects);
  }, [workspace?.id, user?.uid, role]);

  if (!workspace) return null;

  const isWorkspaceAdmin = role === "admin";
  const canCreateProject = role === "admin" || role === "manager";
  const slug = workspace.slug;

  const navItems = [
    { label: "Dashboard", href: `/${slug}/dashboard`, icon: LayoutDashboard },
    { label: "Projects", href: `/${slug}/projects`, icon: FolderKanban },
    { label: "Calendar", href: `/${slug}/calendar`, icon: CalendarDays },
    { label: "Timesheet", href: `/${slug}/timesheet`, icon: Clock },
    { label: "Members", href: `/${slug}/members`, icon: Users },
  ];

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/login");
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-sidebar text-sidebar-foreground shrink-0">
      {/* Workspace header */}
      <div className="flex h-14 items-center px-3 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-between px-2 font-semibold">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-6 w-6 rounded flex items-center justify-center text-xs text-white font-bold shrink-0 bg-primary">
                  {workspace.name[0]?.toUpperCase()}
                </div>
                <span className="truncate">{workspace.name}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            {isWorkspaceAdmin && (
              <DropdownMenuItem asChild>
                <Link to={`/${slug}/settings`}>
                  <Settings className="mr-2 h-4 w-4" />Workspace settings
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 px-2 py-2">
        {/* Main nav */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link key={item.href} to={item.href}
                className={cn(
                  "relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-nav"
                    className="absolute inset-0 rounded-md bg-accent"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <Separator className="my-3" />

        {/* Projects */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Projects</span>
            {canCreateProject && (
              <Link to={`/${slug}/projects?new=1`}>
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Plus className="h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>
          <AnimatePresence initial={false}>
            {projects.map((project) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Link to={`/${slug}/projects/${project.id}/board`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    location.pathname.includes(project.id)
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}>
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                  <span className="truncate">{project.name}</span>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
          {projects.length === 0 && (
            <p className="px-2 text-xs text-muted-foreground py-1">No projects yet</p>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-2 flex items-center gap-1">
        <Link to={`/${slug}/settings`} className="flex-1 min-w-0">
          <Button variant="ghost" className="w-full justify-start gap-2 px-2">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={user?.photoURL ?? undefined} />
              <AvatarFallback className="text-xs">{getInitials(user?.displayName)}</AvatarFallback>
            </Avatar>
            <span className="text-sm truncate">{user?.displayName || user?.email}</span>
          </Button>
        </Link>
        {user && <NotificationBell userId={user.uid} />}
      </div>
      <div className="px-3 py-2 border-t">
        <p className="text-[10px] text-muted-foreground/60 text-center">Carefully crafted by Abhishek</p>
      </div>
    </aside>
  );
}
