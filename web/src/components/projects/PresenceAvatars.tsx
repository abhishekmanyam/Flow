import { AvatarGroup, AvatarGroupOverflow } from "@astryxdesign/core/AvatarGroup";
import { Avatar } from "@astryxdesign/core/Avatar";
import { AvatarStatusDot } from "@astryxdesign/core/Avatar";
import type { BoardPresence } from "@/lib/types";

interface PresenceAvatarsProps {
  users: BoardPresence[];
  currentUserId: string;
}

const MAX_VISIBLE = 5;

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
    <AvatarGroup size="small">
      {visible.map((u) => {
        const isYou = u.userId === currentUserId;
        return (
          <Avatar
            key={u.userId}
            name={u.displayName}
            src={u.avatarUrl ?? undefined}
            alt={isYou ? "You" : u.displayName}
            status={<AvatarStatusDot variant={isYou ? "neutral" : "success"} label={isYou ? "You" : `${u.displayName} online`} />}
          />
        );
      })}
      {overflow > 0 && <AvatarGroupOverflow count={overflow} />}
    </AvatarGroup>
  );
}
