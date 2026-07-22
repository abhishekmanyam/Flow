import { useState, useEffect } from "react";
import { format, startOfDay, isBefore } from "date-fns";
import {
  MapPin,
  Pencil,
  Trash2,
  Globe,
  Users,
  ExternalLink,
  Repeat,
  CircleDashed,
  Check,
  X,
  HelpCircle,
} from "lucide-react";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { Timestamp } from "firebase/firestore";
import { toast } from "@/components/system/toast";
import type { CalendarEvent, EventRSVP, RSVPStatus } from "@/lib/types";
import {
  deleteCalendarEvent,
  excludeCalendarEventOccurrence,
  submitRSVP,
  subscribeToEventRSVPs,
} from "@/lib/firestore";
import { useAuthStore } from "@/store/auth";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Divider } from "@astryxdesign/core/Divider";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Token } from "@astryxdesign/core/Token";
import { Badge } from "@astryxdesign/core/Badge";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Icon } from "@astryxdesign/core/Icon";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { MetadataList } from "@astryxdesign/core/MetadataList";
import { MetadataListItem } from "@astryxdesign/core/MetadataList";
import EventCategoryBadge from "./EventCategoryBadge";
import RegistrationTable from "./RegistrationTable";
import CreateEventDialog from "./CreateEventDialog";

interface EventDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wsId: string;
  workspaceName: string;
  userId: string;
  event: CalendarEvent;
  canEdit: boolean;
  canDelete: boolean;
  canViewRegistrations: boolean;
}

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === "object" && "toDate" in (val as Record<string, unknown>))
    return (val as { toDate: () => Date }).toDate();
  return new Date(val as string);
}

export default function EventDetailSheet({
  open,
  onOpenChange,
  wsId,
  workspaceName,
  userId,
  event,
  canEdit,
  canDelete,
  canViewRegistrations,
}: EventDetailSheetProps) {
  const { user } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rsvps, setRsvps] = useState<EventRSVP[]>([]);
  const [myRsvpStatus, setMyRsvpStatus] = useState<RSVPStatus | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [tab, setTab] = useState("details");

  const startDate = toDate(event.startDate);
  const endDate = toDate(event.endDate);

  // RSVP subscription
  const rsvpEventId =
    event.isRepeating && event.id.includes("_")
      ? event.id.substring(0, event.id.lastIndexOf("_"))
      : event.id;

  useEffect(() => {
    if (!event.rsvpEnabled) return;
    const unsub = subscribeToEventRSVPs(wsId, rsvpEventId, (data) => {
      setRsvps(data);
      const mine = data.find((r) => r.userId === user?.uid);
      setMyRsvpStatus(mine?.status ?? null);
    });
    return unsub;
  }, [wsId, rsvpEventId, event.rsvpEnabled, user?.uid]);

  const handleRsvp = async (status: RSVPStatus) => {
    if (!user?.uid) return;
    setRsvpLoading(true);
    try {
      await submitRSVP(wsId, rsvpEventId, user.uid, status);
      toast.success(
        status === "accepted"
          ? "Accepted"
          : status === "declined"
            ? "Declined"
            : "Marked as tentative"
      );
    } catch {
      toast.error("Failed to update RSVP");
    } finally {
      setRsvpLoading(false);
    }
  };

  const rsvpDeadlinePassed = event.rsvpDeadline
    ? isBefore(toDate(event.rsvpDeadline), new Date())
    : false;

  // Occurrence IDs look like "baseId_timestamp"
  const isOccurrence = event.isRepeating && event.id.includes("_");
  const baseEventId = isOccurrence
    ? event.id.substring(0, event.id.lastIndexOf("_"))
    : event.id;

  const handleDeleteSeries = async () => {
    setDeleting(true);
    try {
      await deleteCalendarEvent(wsId, baseEventId);
      toast.success("Entire series deleted");
      setConfirmOpen(false);
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete series");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteOccurrence = async () => {
    setDeleting(true);
    try {
      const dayStart = startOfDay(startDate);
      await excludeCalendarEventOccurrence(
        wsId,
        baseEventId,
        Timestamp.fromDate(dayStart)
      );
      toast.success("Occurrence removed");
      setConfirmOpen(false);
      onOpenChange(false);
    } catch {
      toast.error("Failed to remove occurrence");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSingle = async () => {
    setDeleting(true);
    try {
      await deleteCalendarEvent(wsId, event.id);
      toast.success("Event deleted");
      setConfirmOpen(false);
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete event");
    } finally {
      setDeleting(false);
    }
  };

  const showRegistrationsTab = event.isPublic && canViewRegistrations;

  const durationLabel = (() => {
    const diff = endDate.getTime() - startDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  })();

  const acceptedCount = rsvps.filter((r) => r.status === "accepted").length;
  const tentativeCount = rsvps.filter((r) => r.status === "tentative").length;
  const declinedCount = rsvps.filter((r) => r.status === "declined").length;

  return (
    <>
      <Dialog
        isOpen={open}
        onOpenChange={onOpenChange}
        width={460}
        maxHeight="100vh"
        position={{ top: 0, right: 0, bottom: 0 }}
      >
        <Layout
          header={
            <VStack padding={4} gap={2}>
              <HStack justify="between" align="center">
                <HStack gap={2} align="center">
                  <EventCategoryBadge category={event.category} />
                  {event.isPublic && (
                    <Token
                      label="Public"
                      color="blue"
                      size="sm"
                      icon={<Globe size={12} />}
                    />
                  )}
                </HStack>
                <IconButton
                  label="Close"
                  tooltip="Close"
                  variant="ghost"
                  size="sm"
                  icon={<X size={18} />}
                  onClick={() => onOpenChange(false)}
                />
              </HStack>
              <Heading level={2} maxLines={3}>
                {event.title}
              </Heading>
            </VStack>
          }
          content={
            <LayoutContent padding={4}>
              <VStack gap={4}>
                {showRegistrationsTab && (
                  <TabList value={tab} onChange={setTab} hasDivider>
                    <Tab value="details" label="Details" />
                    <Tab
                      value="registrations"
                      label="Registrations"
                      icon={<Users size={14} />}
                    />
                  </TabList>
                )}

                {tab === "details" && (
            <VStack gap={4}>
              {/* Field rows */}
              <MetadataList>
                <MetadataListItem
                  label="Date"
                  icon={<Icon icon="calendar" size="sm" />}
                >
                  <VStack gap={0}>
                    <Text weight="medium">
                      {format(startDate, "EEEE, MMMM d, yyyy")}
                    </Text>
                    <Text type="supporting" color="secondary">
                      {event.allDay
                        ? "All day"
                        : `${format(startDate, "h:mm a")} – ${format(endDate, "h:mm a")}`}
                    </Text>
                  </VStack>
                </MetadataListItem>

                {!event.allDay && (
                  <MetadataListItem
                    label="Duration"
                    icon={<Icon icon="clock" size="sm" />}
                  >
                    <Text weight="medium">{durationLabel}</Text>
                  </MetadataListItem>
                )}

                {event.isRepeating && event.repeatingType && (
                  <MetadataListItem
                    label="Repeats"
                    icon={<Repeat size={16} />}
                  >
                    <VStack gap={0}>
                      <Text weight="medium">
                        {event.repeatingType.charAt(0).toUpperCase() +
                          event.repeatingType.slice(1)}
                      </Text>
                      <Text type="supporting" color="secondary">
                        {event.repeatingEndDate
                          ? `Until ${format(toDate(event.repeatingEndDate), "MMM d, yyyy")}`
                          : "Repeats indefinitely"}
                      </Text>
                    </VStack>
                  </MetadataListItem>
                )}

                {event.location && (
                  <MetadataListItem
                    label="Location"
                    icon={<MapPin size={16} />}
                  >
                    <Text weight="medium">{event.location}</Text>
                  </MetadataListItem>
                )}
              </MetadataList>

              {/* Description */}
              {event.description && (
                <>
                  <Divider />
                  <VStack gap={2}>
                    <Text type="label" color="secondary" weight="semibold">
                      Description
                    </Text>
                    <Text textWrap="pretty">{event.description}</Text>
                  </VStack>
                </>
              )}

              {/* RSVP */}
              {event.rsvpEnabled && (
                <>
                  <Divider />
                  <VStack gap={3}>
                    <HStack justify="between" align="center">
                      <Text type="label" color="secondary" weight="semibold">
                        RSVP
                      </Text>
                      {event.isOptional && (
                        <Token
                          label="Optional"
                          color="gray"
                          size="sm"
                          icon={<CircleDashed size={12} />}
                        />
                      )}
                    </HStack>

                    {rsvpDeadlinePassed ? (
                      <Text type="supporting" color="secondary">
                        RSVP deadline has passed
                      </Text>
                    ) : (
                      <HStack gap={2}>
                        <Button
                          label="Accept"
                          size="sm"
                          width="100%"
                          variant={myRsvpStatus === "accepted" ? "primary" : "secondary"}
                          icon={<Check size={14} />}
                          isDisabled={rsvpLoading}
                          onClick={() => handleRsvp("accepted")}
                        />
                        <Button
                          label="Maybe"
                          size="sm"
                          width="100%"
                          variant={myRsvpStatus === "tentative" ? "primary" : "secondary"}
                          icon={<HelpCircle size={14} />}
                          isDisabled={rsvpLoading}
                          onClick={() => handleRsvp("tentative")}
                        />
                        <Button
                          label="Decline"
                          size="sm"
                          width="100%"
                          variant={myRsvpStatus === "declined" ? "destructive" : "secondary"}
                          icon={<X size={14} />}
                          isDisabled={rsvpLoading}
                          onClick={() => handleRsvp("declined")}
                        />
                      </HStack>
                    )}

                    {event.rsvpDeadline && !rsvpDeadlinePassed && (
                      <Text type="supporting" color="secondary">
                        RSVP by {format(toDate(event.rsvpDeadline), "MMM d, yyyy")}
                      </Text>
                    )}

                    {canViewRegistrations && rsvps.length > 0 && (
                      <HStack gap={4}>
                        <HStack gap={1} align="center">
                          <StatusDot variant="success" label="Accepted" />
                          <Text type="supporting" color="secondary">
                            {acceptedCount} accepted
                          </Text>
                        </HStack>
                        <HStack gap={1} align="center">
                          <StatusDot variant="warning" label="Tentative" />
                          <Text type="supporting" color="secondary">
                            {tentativeCount} maybe
                          </Text>
                        </HStack>
                        <HStack gap={1} align="center">
                          <StatusDot variant="error" label="Declined" />
                          <Text type="supporting" color="secondary">
                            {declinedCount} declined
                          </Text>
                        </HStack>
                      </HStack>
                    )}
                  </VStack>
                </>
              )}

              {!event.rsvpEnabled && event.isOptional && (
                <>
                  <Divider />
                  <HStack gap={2} align="center">
                    <Token
                      label="Optional event"
                      color="gray"
                      size="sm"
                      icon={<CircleDashed size={12} />}
                    />
                    <Text type="supporting" color="secondary">
                      Shows as tentative in external calendars
                    </Text>
                  </HStack>
                </>
              )}

              {/* Status */}
              <Divider />
              <VStack gap={2}>
                <Text type="label" color="secondary" weight="semibold">
                  Status
                </Text>
                <HStack gap={2} align="center">
                  {event.isPublic ? (
                    <Token
                      label="Public event"
                      color="blue"
                      size="sm"
                      icon={<Globe size={12} />}
                    />
                  ) : (
                    <Token label="Internal only" color="gray" size="sm" />
                  )}
                  {event.isPublic && (
                    <Badge
                      label={
                        event.registrationOpen
                          ? "Registration open"
                          : "Registration closed"
                      }
                    />
                  )}
                  {event.maxRegistrations != null && (
                    <Badge label={`Max ${event.maxRegistrations} spots`} />
                  )}
                </HStack>
              </VStack>

              {/* Public link */}
              {event.isPublic && canEdit && (
                <>
                  <Divider />
                  <VStack gap={2}>
                    <Text type="label" color="secondary" weight="semibold">
                      Public link
                    </Text>
                    <HStack gap={2} align="center">
                      <Text type="code" maxLines={1}>
                        /events/{wsId}/{event.id}
                      </Text>
                      <Button
                        label="Copy"
                        variant="secondary"
                        size="sm"
                        icon={<ExternalLink size={14} />}
                        onClick={() => {
                          const url = `${window.location.origin}/events/${wsId}/${event.id}`;
                          navigator.clipboard.writeText(url);
                          toast.success("Link copied to clipboard");
                        }}
                      />
                    </HStack>
                  </VStack>
                </>
              )}
            </VStack>
          )}

          {showRegistrationsTab && tab === "registrations" && (
            <RegistrationTable wsId={wsId} event={event} />
          )}

                {/* Actions */}
                {canEdit && (
                  <>
                    <Divider />
                    <HStack gap={2}>
                      <Button
                        label="Edit"
                        variant="secondary"
                        width="100%"
                        icon={<Pencil size={16} />}
                        onClick={() => setEditOpen(true)}
                      />
                      {canDelete && (
                        <Button
                          label="Delete"
                          variant="destructive"
                          icon={<Trash2 size={16} />}
                          onClick={() => setConfirmOpen(true)}
                        />
                      )}
                    </HStack>
                  </>
                )}
              </VStack>
            </LayoutContent>
          }
        />
      </Dialog>

      {/* Delete confirmation (supports occurrence vs series for repeating) */}
      <Dialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        purpose="required"
        width={420}
      >
        <DialogHeader title="Delete event" onOpenChange={setConfirmOpen} />
        <VStack padding={4} gap={4}>
          <Text>
            {event.isRepeating
              ? `Do you want to remove just this occurrence (${format(startDate, "MMM d")}) or delete the entire series?`
              : `Are you sure you want to delete "${event.title}"? This action cannot be undone.`}
          </Text>
          <HStack justify="end" gap={2}>
            <Button
              label="Cancel"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
            />
            {event.isRepeating ? (
              <>
                <Button
                  label="This occurrence"
                  variant="secondary"
                  isLoading={deleting}
                  onClick={handleDeleteOccurrence}
                />
                <Button
                  label="Entire series"
                  variant="destructive"
                  isLoading={deleting}
                  onClick={handleDeleteSeries}
                />
              </>
            ) : (
              <Button
                label="Delete"
                variant="destructive"
                isLoading={deleting}
                onClick={handleDeleteSingle}
              />
            )}
          </HStack>
        </VStack>
      </Dialog>

      <CreateEventDialog
        key={event.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        wsId={wsId}
        workspaceName={workspaceName}
        userId={userId}
        event={event}
      />
    </>
  );
}
