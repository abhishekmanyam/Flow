import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { subscribeToNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/firestore";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@/lib/types";

function notifLabel(n: Notification) {
  switch (n.type) {
    case "task_assigned": return `You were assigned to "${n.taskTitle}"`;
    case "mentioned": return `${n.actorName} mentioned you in "${n.taskTitle}"`;
    case "due_soon": return `"${n.taskTitle}" is due soon`;
    default: return "New notification";
  }
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative shrink-0">
          <Bell className="h-4 w-4" />
          {notifications.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
              {notifications.length > 9 ? "9+" : notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {notifications.length > 0 && (
            <button onClick={handleMarkAll} className="text-xs text-muted-foreground hover:text-foreground">
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">All caught up!</p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div key={n.id} className="flex gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleMarkOne(n.id)}>
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{notifLabel(n)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(
                        (n.createdAt as unknown as { toDate(): Date }).toDate?.() ?? new Date(n.createdAt as unknown as string),
                        { addSuffix: true }
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
