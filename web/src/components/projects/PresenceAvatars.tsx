import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { BoardPresence } from "@/lib/types";

interface PresenceAvatarsProps {
  users: BoardPresence[];
  currentUserId: string;
}

const MAX_VISIBLE = 5;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function PresenceAvatars({ users, currentUserId }: PresenceAvatarsProps) {
  if (users.length === 0) return null;

  // Sort: other users first, current user last
  const sorted = [...users].sort((a, b) => {
    if (a.userId === currentUserId) return 1;
    if (b.userId === currentUserId) return -1;
    return a.displayName.localeCompare(b.displayName);
  });

  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - MAX_VISIBLE;

  return (
    <TooltipProvider>
      <AvatarGroup>
        {visible.map((u) => (
          <Tooltip key={u.userId}>
            <TooltipTrigger asChild>
              <Avatar size="sm">
                {u.avatarUrl ? (
                  <AvatarImage src={u.avatarUrl} alt={u.displayName} />
                ) : null}
                <AvatarFallback>{getInitials(u.displayName)}</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              {u.userId === currentUserId ? "You" : u.displayName}
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AvatarGroupCount className="text-xs">
                +{overflow}
              </AvatarGroupCount>
            </TooltipTrigger>
            <TooltipContent>
              {sorted
                .slice(MAX_VISIBLE)
                .map((u) => (u.userId === currentUserId ? "You" : u.displayName))
                .join(", ")}
            </TooltipContent>
          </Tooltip>
        )}
      </AvatarGroup>
    </TooltipProvider>
  );
}
