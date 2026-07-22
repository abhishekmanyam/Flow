import { useEffect, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Users, Settings,
  LogOut, Plus, Clock, CalendarDays, ClipboardList,
} from "lucide-react";
import { SideNav, SideNavHeading, SideNavSection, SideNavItem } from "@astryxdesign/core/SideNav";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useAuthStore } from "@/store/auth";
import { subscribeToAccessibleProjects } from "@/lib/firestore";
import { toast } from "@/components/system/toast";
import type { Project } from "@/lib/types";
import NotificationBell from "@/components/notifications/NotificationBell";

/**
 * Per-project colored dot rendered as the SideNavItem icon. SideNavItem's `icon`
 * prop is a component (ComponentType<SVGProps>), so we bake the project color
 * into a cached SVG component keyed by color to keep component identity stable.
 */
const dotCache = new Map<string, ComponentType<SVGProps<SVGSVGElement>>>();
function projectDot(color: string): ComponentType<SVGProps<SVGSVGElement>> {
  let Dot = dotCache.get(color);
  if (!Dot) {
    Dot = (props: SVGProps<SVGSVGElement>) => (
      <svg viewBox="0 0 8 8" {...props}>
        <circle cx="4" cy="4" r="4" fill={color} />
      </svg>
    );
    dotCache.set(color, Dot);
  }
  return Dot;
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

  const canCreateProject = role === "admin" || role === "manager";
  const slug = workspace.slug;

  const navItems = [
    { label: "Dashboard", href: `/${slug}/dashboard`, icon: LayoutDashboard },
    { label: "Projects", href: `/${slug}/projects`, icon: FolderKanban },
    { label: "Calendar", href: `/${slug}/calendar`, icon: CalendarDays },
    { label: "Timesheet", href: `/${slug}/timesheet`, icon: Clock },
    { label: "Members", href: `/${slug}/members`, icon: Users },
    ...(role === "admin" || role === "manager"
      ? [{ label: "Inquiries", href: `/${slug}/inquiries`, icon: ClipboardList }]
      : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/login");
  };

  const userMenu = (
    <DropdownMenu
      button={{
        label: user?.displayName || user?.email || "Account",
        variant: "ghost",
        width: "fill",
        icon: <Avatar size="xsmall" name={user?.displayName || user?.email || undefined} src={user?.photoURL ?? undefined} />,
      }}
      menuWidth={220}
      items={[
        { label: "Settings", icon: Settings, onClick: () => navigate(`/${slug}/settings`) },
        { type: "divider" },
        { label: "Sign out", icon: LogOut, onClick: handleSignOut },
      ]}
    />
  );

  return (
    <SideNav
      header={
        <SideNavHeading
          heading={workspace.name}
          headingHref={`/${slug}/dashboard`}
          icon={<Avatar size="small" name={workspace.name} />}
        />
      }
      footer={
        <VStack gap={2}>
          {userMenu}
          <Text type="supporting" size="2xs" color="disabled" justify="center">
            Carefully crafted by Abhishek
          </Text>
        </VStack>
      }
      footerIcons={user ? <NotificationBell userId={user.uid} /> : undefined}
    >
      <SideNavSection title="Workspace" isHeaderHidden>
        {navItems.map((item) => (
          <SideNavItem
            key={item.href}
            label={item.label}
            href={item.href}
            icon={item.icon}
            isSelected={location.pathname === item.href}
          />
        ))}
      </SideNavSection>

      <SideNavSection
        title="Projects"
        endContent={
          canCreateProject ? (
            <IconButton
              label="New project"
              tooltip="New project"
              size="sm"
              variant="ghost"
              icon={<Plus />}
              onClick={() => navigate(`/${slug}/projects?new=1`)}
            />
          ) : undefined
        }
      >
        {projects.map((project) => (
          <SideNavItem
            key={project.id}
            label={project.name}
            href={`/${slug}/projects/${project.id}/board`}
            icon={projectDot(project.color)}
            isSelected={location.pathname.includes(project.id)}
          />
        ))}
        {projects.length === 0 && (
          <SideNavItem label="No projects yet" isDisabled />
        )}
      </SideNavSection>
    </SideNav>
  );
}
