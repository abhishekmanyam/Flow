import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { subscribeToNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/firestore";
import type { Notification } from "@/lib/types";
import { Popover } from "@astryxdesign/core/Popover";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Divider } from "@astryxdesign/core/Divider";
import { List } from "@astryxdesign/core/List";
import { ListItem } from "@astryxdesign/core/List";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Timestamp } from "@astryxdesign/core/Timestamp";

function notifLabel(n: Notification) {
  switch (n.type) {
    case "task_assigned": return `You were assigned to "${n.taskTitle}"`;
    case "mentioned": return `${n.actorName} mentioned you in "${n.taskTitle}"`;
    case "due_soon": return `"${n.taskTitle}" is due soon`;
    default: return "New notification";
  }
}

function notifDate(n: Notification): string {
  const raw = n.createdAt as unknown as { toDate?: () => Date };
  const d = typeof raw?.toDate === "function" ? raw.toDate() : new Date(n.createdAt as unknown as string);
  return d.toISOString();
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToNotifications(userId, setNotifications);
    return unsub;
  }, [userId]);

  const handleMarkAll = async () => {
    await markAllNotificationsRead(userId);
  };

  const handleMarkOne = async (id: string) => {
    await markNotificationRead(userId, id);
  };

  const count = notifications.length;

  return (
    <Popover
      isOpen={open}
      onOpenChange={setOpen}
      placement="above"
      alignment="start"
      width={340}
      label="Notifications"
      hasCloseButton={false}
      content={
        <VStack gap={0}>
          <HStack justify="between" align="center" paddingInline={4} paddingBlock={3}>
            <Heading level={4}>Notifications</Heading>
            {count > 0 && (
              <Button label="Mark all read" variant="ghost" size="sm" onClick={handleMarkAll} />
            )}
          </HStack>
          <Divider />
          {count === 0 ? (
            <HStack justify="center" paddingBlock={6} paddingInline={4}>
              <Text type="supporting">All caught up!</Text>
            </HStack>
          ) : (
            <List hasDividers density="compact">
              {notifications.map((n) => (
                <ListItem
                  key={n.id}
                  label={notifLabel(n)}
                  description={<Timestamp value={notifDate(n)} format="relative" />}
                  startContent={<StatusDot variant="accent" label="Unread" />}
                  onClick={() => handleMarkOne(n.id)}
                />
              ))}
            </List>
          )}
        </VStack>
      }
    >
      <Button
        label="Notifications"
        variant="ghost"
        size="sm"
        icon={<Bell size={16} />}
        endContent={count > 0 ? <Badge variant="error" label={count > 9 ? "9+" : count} /> : undefined}
      />
    </Popover>
  );
}
