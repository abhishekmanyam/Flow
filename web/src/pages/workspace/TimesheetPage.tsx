import { useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth";
import {
  clockIn,
  clockOut,
  updateClockEntry,
  subscribeToActiveClocks,
  subscribeToMyActiveClock,
  getAttendanceByRange,
  subscribeToMembers,
} from "@/lib/firestore";
import type { ClockEntry, WorkspaceMember } from "@/lib/types";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import {
  ShieldAlert,
  Building2,
  Wifi,
  LogIn,
  LogOut,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Search,
  AlertTriangle,
} from "lucide-react";
import { addDays, isSameDay, isToday, format } from "date-fns";
import { toast } from "@/components/system/toast";
import { Layout, LayoutHeader, LayoutContent } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Token } from "@astryxdesign/core/Token";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { TextInput } from "@astryxdesign/core/TextInput";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { List, ListItem } from "@astryxdesign/core/List";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Banner } from "@astryxdesign/core/Banner";

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = "week" | "month";
type TypeFilter = "all" | "office" | "remote";

interface DayData {
  date: Date;
  entries: ClockEntry[];
  totalHours: number;
  hasOffice: boolean;
  hasRemote: boolean;
}

interface MonthDayData extends DayData {
  isCurrentMonth: boolean;
}

interface TeamDayData extends DayData {
  memberCount: number;
}

interface TeamMonthDayData extends TeamDayData {
  isCurrentMonth: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === "object" && "toDate" in (val as Record<string, unknown>)) {
    return (val as { toDate: () => Date }).toDate();
  }
  return new Date(val as string);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getElapsedHours(clockInTime: Date): number {
  return (Date.now() - clockInTime.getTime()) / (1000 * 60 * 60);
}

function getWeekRange(offset: number = 0): { start: Date; end: Date; label: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const label = `${monday.toLocaleDateString([], { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
  return { start: monday, end: sunday, label };
}

function getMonthRange(offset: number = 0): { start: Date; end: Date; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  const label = format(start, "MMMM yyyy");
  return { start, end, label };
}

function buildWeekDays(weekStart: Date, entries: ClockEntry[]): DayData[] {
  const days: DayData[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dayEntries = entries.filter((e) => isSameDay(toDate(e.clockIn), date));
    const totalHours = dayEntries.reduce((sum, e) => sum + (e.totalHours ?? 0), 0);
    const hasOffice = dayEntries.some((e) => e.type === "office");
    const hasRemote = dayEntries.some((e) => e.type === "remote");
    days.push({ date, entries: dayEntries, totalHours, hasOffice, hasRemote });
  }
  return days;
}

function buildMonthGrid(monthStart: Date, entries: ClockEntry[]): MonthDayData[] {
  const month = monthStart.getMonth();
  const year = monthStart.getFullYear();
  const lastDay = new Date(year, month + 1, 0);

  const firstDow = monthStart.getDay();
  const paddingBefore = (firstDow + 6) % 7;
  const gridStart = addDays(monthStart, -paddingBefore);

  const lastDow = lastDay.getDay();
  const paddingAfter = lastDow === 0 ? 0 : 7 - lastDow;
  const totalDays = paddingBefore + lastDay.getDate() + paddingAfter;

  const days: MonthDayData[] = [];
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(gridStart, i);
    const isCurrentMonth = date.getMonth() === month && date.getFullYear() === year;
    const dayEntries = isCurrentMonth ? entries.filter((e) => isSameDay(toDate(e.clockIn), date)) : [];
    const totalHours = dayEntries.reduce((sum, e) => sum + (e.totalHours ?? 0), 0);
    const hasOffice = dayEntries.some((e) => e.type === "office");
    const hasRemote = dayEntries.some((e) => e.type === "remote");
    days.push({ date, entries: dayEntries, totalHours, hasOffice, hasRemote, isCurrentMonth });
  }
  return days;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CLOCK_HOURS = 8;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Live Timer ──────────────────────────────────────────────────────────────

function LiveTimer({ clockInTime }: { clockInTime: Date }) {
  const [elapsed, setElapsed] = useState(() => getElapsedHours(clockInTime));

  useEffect(() => {
    const interval = setInterval(() => setElapsed(getElapsedHours(clockInTime)), 1000);
    return () => clearInterval(interval);
  }, [clockInTime]);

  const h = Math.floor(elapsed);
  const m = Math.floor((elapsed - h) * 60);
  const s = Math.floor(((elapsed - h) * 60 - m) * 60);

  const remaining = Math.max(0, MAX_CLOCK_HOURS - elapsed);
  const remH = Math.floor(remaining);
  const remM = Math.floor((remaining - remH) * 60);

  return (
    <VStack gap={0.5} hAlign="center">
      <Text size="2xl" weight="bold" hasTabularNumbers>
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </Text>
      {remaining > 0 && remaining < MAX_CLOCK_HOURS && (
        <Text type="supporting" color="secondary">
          Auto clock-out in {remH > 0 ? `${remH}h ` : ""}{remM}m
        </Text>
      )}
    </VStack>
  );
}

function ShiftProgress({ clockInTime }: { clockInTime: Date }) {
  const [pct, setPct] = useState(() => Math.min(100, (getElapsedHours(clockInTime) / MAX_CLOCK_HOURS) * 100));

  useEffect(() => {
    const interval = setInterval(() => {
      setPct(Math.min(100, (getElapsedHours(clockInTime) / MAX_CLOCK_HOURS) * 100));
    }, 10_000);
    return () => clearInterval(interval);
  }, [clockInTime]);

  const isWarning = pct >= 75;

  return (
    <VStack gap={1} width="100%">
      <HStack justify="between" align="center">
        <Text type="supporting" color="secondary">
          {Math.round(pct)}% of {MAX_CLOCK_HOURS}h shift
        </Text>
        {isWarning && (
          <HStack gap={1} align="center">
            <AlertTriangle size={12} />
            <Text type="supporting" color="secondary">
              {pct >= 100 ? "Limit reached" : "Nearing limit"}
            </Text>
          </HStack>
        )}
      </HStack>
      <ProgressBar label="Shift progress" isLabelHidden value={pct} variant={isWarning ? "warning" : "accent"} />
    </VStack>
  );
}

// ─── Clock In/Out Card ───────────────────────────────────────────────────────

function ClockCard({
  wsId,
  userId,
  activeEntry,
  officeAllowed,
}: {
  wsId: string;
  userId: string;
  activeEntry: ClockEntry | null;
  officeAllowed: boolean;
}) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeEntry) return;
    const clockInTime = toDate(activeEntry.clockIn);
    const elapsed = getElapsedHours(clockInTime);

    if (elapsed >= MAX_CLOCK_HOURS) {
      clockOut(wsId, activeEntry.id, clockInTime, activeEntry.breakMinutes).then(() => {
        toast.info("Auto clocked out after 8 hours. Please clock in again to continue.");
      });
      return;
    }

    const remainingMs = (MAX_CLOCK_HOURS - elapsed) * 60 * 60 * 1000;
    const timer = setTimeout(() => {
      clockOut(wsId, activeEntry.id, clockInTime, activeEntry.breakMinutes).then(() => {
        toast.info("Auto clocked out after 8 hours. Please clock in again to continue.");
      });
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [activeEntry, wsId]);

  const handleClockIn = async (type: "office" | "remote") => {
    if (activeEntry) return;
    if (type === "office" && !officeAllowed) {
      toast.error("Office clock-in is only allowed from the authorized network");
      return;
    }
    setLoading(true);
    try {
      await clockIn(wsId, userId, type);
      toast.success(`Clocked in (${type})`);
    } catch (err) {
      if (err instanceof Error && err.message === "Already clocked in") {
        toast.error("You are already clocked in");
      } else {
        toast.error("Failed to clock in");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    setLoading(true);
    try {
      await clockOut(wsId, activeEntry.id, toDate(activeEntry.clockIn), activeEntry.breakMinutes);
      toast.success("Clocked out");
    } catch {
      toast.error("Failed to clock out");
    } finally {
      setLoading(false);
    }
  };

  if (activeEntry) {
    return (
      <Card variant="green">
        <VStack gap={5}>
          <VStack gap={2} hAlign="center">
            <StatusDot variant="success" label="Clocked in" isPulsing />
            <LiveTimer clockInTime={toDate(activeEntry.clockIn)} />
            <HStack gap={2} align="center">
              <Token
                label={activeEntry.type === "office" ? "Office" : "Remote"}
                icon={activeEntry.type === "office" ? <Building2 size={12} /> : <Wifi size={12} />}
              />
              <Text type="supporting" color="secondary">
                since {formatTime(toDate(activeEntry.clockIn))}
              </Text>
            </HStack>
          </VStack>
          <ShiftProgress clockInTime={toDate(activeEntry.clockIn)} />
          <Button
            label="Clock Out"
            variant="destructive"
            width="100%"
            icon={<LogOut size={16} />}
            onClick={handleClockOut}
            isLoading={loading}
          />
        </VStack>
      </Card>
    );
  }

  return (
    <Grid columns={2} gap={3}>
      <ClickableCard
        label="Clock in from office"
        onClick={() => handleClockIn("office")}
        isDisabled={loading || !officeAllowed}
        padding={6}
      >
        <VStack gap={2} hAlign="center">
          <Building2 size={28} />
          <Text weight="semibold">Office</Text>
          <Text type="supporting" color="secondary">
            Clock in from office
          </Text>
          {!officeAllowed && (
            <HStack gap={1} align="center">
              <ShieldAlert size={12} />
              <Text type="supporting" color="secondary">
                Requires authorized network
              </Text>
            </HStack>
          )}
        </VStack>
      </ClickableCard>
      <ClickableCard label="Clock in remotely" onClick={() => handleClockIn("remote")} isDisabled={loading} padding={6}>
        <VStack gap={2} hAlign="center">
          <Wifi size={28} />
          <Text weight="semibold">Remote</Text>
          <Text type="supporting" color="secondary">
            Clock in from home
          </Text>
        </VStack>
      </ClickableCard>
    </Grid>
  );
}

// ─── Entry Row ───────────────────────────────────────────────────────────────

function EntryRow({ entry, wsId }: { entry: ClockEntry; wsId: string }) {
  const [notes, setNotes] = useState(entry.notes);

  const handleNotesBlur = useCallback(async () => {
    if (notes === entry.notes) return;
    try {
      await updateClockEntry(wsId, entry.id, { notes });
    } catch {
      toast.error("Failed to save notes");
    }
  }, [notes, entry.notes, entry.id, wsId]);

  const clockInDate = toDate(entry.clockIn);
  const clockOutDate = entry.clockOut ? toDate(entry.clockOut) : null;

  return (
    <ListItem
      label={`${formatTime(clockInDate)} – ${clockOutDate ? formatTime(clockOutDate) : "In progress"}`}
      description={
        <TextInput
          label="Notes"
          isLabelHidden
          size="sm"
          placeholder="Add notes..."
          value={notes}
          onChange={setNotes}
          onBlur={handleNotesBlur}
        />
      }
      endContent={
        <HStack gap={2} align="center">
          <Token
            label={entry.type === "office" ? "Office" : "Remote"}
            icon={entry.type === "office" ? <Building2 size={12} /> : <Wifi size={12} />}
          />
          {entry.totalHours != null && (
            <Text type="supporting" color="secondary" hasTabularNumbers>
              {formatDuration(entry.totalHours)}
            </Text>
          )}
        </HStack>
      }
    />
  );
}

// ─── Day Tile (shared by week/month, personal/team grids) ───────────────────

function DayTile({
  date,
  isCurrentMonth = true,
  isSelected,
  onSelect,
  totalHours,
  hasOffice,
  hasRemote,
  extra,
}: {
  date: Date;
  isCurrentMonth?: boolean;
  isSelected: boolean;
  onSelect: () => void;
  totalHours: number;
  hasOffice: boolean;
  hasRemote: boolean;
  extra?: ReactNode;
}) {
  const today = isToday(date);
  return (
    <ClickableCard
      label={format(date, "EEEE, MMM d")}
      onClick={onSelect}
      isDisabled={!isCurrentMonth}
      padding={2}
      variant={isSelected ? "blue" : today ? "gray" : "default"}
    >
      <VStack gap={0.5} hAlign="center">
        <Text type="supporting" weight={today ? "bold" : "medium"} color={isCurrentMonth ? "primary" : "disabled"}>
          {format(date, "d")}
        </Text>
        {totalHours > 0 && (
          <Text type="supporting" size="2xs" hasTabularNumbers>
            {formatDuration(totalHours)}
          </Text>
        )}
        {extra}
        {(hasOffice || hasRemote) && (
          <HStack gap={1}>
            {hasOffice && <StatusDot variant="accent" label="Office" tooltip="Office" />}
            {hasRemote && <StatusDot variant="success" label="Remote" tooltip="Remote" />}
          </HStack>
        )}
      </VStack>
    </ClickableCard>
  );
}

function WeekDayHeader() {
  return (
    <Grid columns={7} gap={2}>
      {DAY_LABELS.map((label) => (
        <Text key={label} type="supporting" color="secondary" justify="center">
          {label}
        </Text>
      ))}
    </Grid>
  );
}

function WeekCalendarGrid<T extends DayData>({
  days,
  selectedDate,
  onSelectDate,
  renderExtra,
}: {
  days: T[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  renderExtra?: (day: T) => ReactNode;
}) {
  return (
    <VStack gap={2}>
      <WeekDayHeader />
      <Grid columns={7} gap={2}>
        {days.map((day) => {
          const selected = !!selectedDate && isSameDay(day.date, selectedDate);
          return (
            <DayTile
              key={day.date.toISOString()}
              date={day.date}
              isSelected={selected}
              onSelect={() => onSelectDate(selected ? null : day.date)}
              totalHours={day.totalHours}
              hasOffice={day.hasOffice}
              hasRemote={day.hasRemote}
              extra={renderExtra?.(day)}
            />
          );
        })}
      </Grid>
    </VStack>
  );
}

function MonthCalendarGrid<T extends MonthDayData>({
  days,
  selectedDate,
  onSelectDate,
  renderExtra,
}: {
  days: T[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  renderExtra?: (day: T) => ReactNode;
}) {
  return (
    <VStack gap={2}>
      <WeekDayHeader />
      <Grid columns={7} gap={1}>
        {days.map((day) => {
          const selected = !!selectedDate && isSameDay(day.date, selectedDate);
          return (
            <DayTile
              key={day.date.toISOString()}
              date={day.date}
              isCurrentMonth={day.isCurrentMonth}
              isSelected={selected}
              onSelect={() => {
                if (!day.isCurrentMonth) return;
                onSelectDate(selected ? null : day.date);
              }}
              totalHours={day.totalHours}
              hasOffice={day.hasOffice}
              hasRemote={day.hasRemote}
              extra={day.isCurrentMonth ? renderExtra?.(day) : undefined}
            />
          );
        })}
      </Grid>
    </VStack>
  );
}

// ─── Shared UI Components ────────────────────────────────────────────────────

function ViewModeToggle({ viewMode, onViewModeChange }: { viewMode: ViewMode; onViewModeChange: (mode: ViewMode) => void }) {
  return (
    <SegmentedControl label="Calendar view" value={viewMode} onChange={(v) => onViewModeChange(v as ViewMode)}>
      <SegmentedControlItem value="week" label="Week" />
      <SegmentedControlItem value="month" label="Month" />
    </SegmentedControl>
  );
}

function PeriodNavigator({
  offset,
  setOffset,
  label,
  viewMode,
}: {
  offset: number;
  setOffset: React.Dispatch<React.SetStateAction<number>>;
  label: string;
  viewMode: ViewMode;
}) {
  return (
    <HStack justify="between" align="center">
      <HStack gap={2} align="center">
        <Calendar size={16} />
        <Text weight="medium">{label}</Text>
      </HStack>
      <HStack gap={1} align="center">
        <Button label="Previous period" isIconOnly icon={<ChevronLeft size={16} />} variant="secondary" size="sm" onClick={() => setOffset((o) => o - 1)} />
        <Button
          label={viewMode === "week" ? "This week" : "This month"}
          variant="secondary"
          size="sm"
          onClick={() => setOffset(0)}
          isDisabled={offset === 0}
        />
        <Button
          label="Next period"
          isIconOnly
          icon={<ChevronRight size={16} />}
          variant="secondary"
          size="sm"
          onClick={() => setOffset((o) => o + 1)}
          isDisabled={offset >= 0}
        />
      </HStack>
    </HStack>
  );
}

function PeriodTotals({ days, hoursLabel = "Total hours" }: { days: DayData[]; hoursLabel?: string }) {
  const totalHours = days.reduce((sum, d) => sum + d.totalHours, 0);
  const officeDays = days.filter((d) => d.hasOffice).length;
  const remoteDays = days.filter((d) => d.hasRemote).length;

  return (
    <Card padding={3}>
      <HStack gap={6} align="center">
        <VStack gap={0}>
          <Text size="lg" weight="bold" hasTabularNumbers>
            {formatDuration(totalHours)}
          </Text>
          <Text type="supporting" color="secondary">
            {hoursLabel}
          </Text>
        </VStack>
        <VStack gap={0}>
          <Text size="lg" weight="bold" hasTabularNumbers>
            {officeDays}
          </Text>
          <Text type="supporting" color="secondary">
            Office days
          </Text>
        </VStack>
        <VStack gap={0}>
          <Text size="lg" weight="bold" hasTabularNumbers>
            {remoteDays}
          </Text>
          <Text type="supporting" color="secondary">
            Remote days
          </Text>
        </VStack>
        <HStack gap={3} justify="end" width="100%">
          <HStack gap={1} align="center">
            <StatusDot variant="accent" label="Office" />
            <Text type="supporting" color="secondary">
              Office
            </Text>
          </HStack>
          <HStack gap={1} align="center">
            <StatusDot variant="success" label="Remote" />
            <Text type="supporting" color="secondary">
              Remote
            </Text>
          </HStack>
        </HStack>
      </HStack>
    </Card>
  );
}

// ─── My Timesheet Tab ────────────────────────────────────────────────────────

function MyTimesheetTab({ wsId, userId, officeAllowed }: { officeAllowed: boolean; wsId: string; userId: string }) {
  const [activeEntry, setActiveEntry] = useState<ClockEntry | null>(null);
  const [rangeEntries, setRangeEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => subscribeToMyActiveClock(wsId, userId, setActiveEntry), [wsId, userId]);

  const week = useMemo(() => getWeekRange(weekOffset), [weekOffset]);
  const monthRange = useMemo(() => getMonthRange(monthOffset), [monthOffset]);
  const range = viewMode === "week" ? week : monthRange;

  useEffect(() => {
    setLoading(true);
    getAttendanceByRange(wsId, range.start, range.end)
      .then((all) => setRangeEntries(all.filter((e) => e.userId === userId)))
      .finally(() => setLoading(false));
  }, [wsId, userId, range.start.getTime(), range.end.getTime()]);

  const weekDays = useMemo(() => (viewMode === "week" ? buildWeekDays(week.start, rangeEntries) : []), [viewMode, week.start, rangeEntries]);
  const monthDays = useMemo(() => (viewMode === "month" ? buildMonthGrid(monthRange.start, rangeEntries) : []), [viewMode, monthRange.start, rangeEntries]);
  const monthCurrentDays = useMemo(() => monthDays.filter((d) => d.isCurrentMonth), [monthDays]);

  const selectedDayEntries = useMemo(() => {
    if (!selectedDate) return [];
    const source = viewMode === "week" ? weekDays : monthDays;
    const day = source.find((d) => isSameDay(d.date, selectedDate));
    return day?.entries ?? [];
  }, [selectedDate, viewMode, weekDays, monthDays]);

  useEffect(() => setSelectedDate(null), [weekOffset]);
  useEffect(() => setSelectedDate(null), [monthOffset]);
  useEffect(() => setSelectedDate(null), [viewMode]);

  return (
    <VStack gap={4}>
      <ClockCard wsId={wsId} userId={userId} activeEntry={activeEntry} officeAllowed={officeAllowed} />

      <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />

      <PeriodNavigator
        offset={viewMode === "week" ? weekOffset : monthOffset}
        setOffset={viewMode === "week" ? setWeekOffset : setMonthOffset}
        label={range.label}
        viewMode={viewMode}
      />

      {loading ? (
        <Skeleton height={220} radius={2} />
      ) : viewMode === "week" ? (
        <>
          <WeekCalendarGrid days={weekDays} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <PeriodTotals days={weekDays} />
        </>
      ) : (
        <>
          <MonthCalendarGrid days={monthDays} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <PeriodTotals days={monthCurrentDays} />
        </>
      )}

      {selectedDate && (
        <VStack gap={2}>
          <Heading level={4}>{format(selectedDate, "EEEE, MMM d")}</Heading>
          {selectedDayEntries.length === 0 ? (
            <EmptyState title="No entries for this day" isCompact />
          ) : (
            <List hasDividers>
              {selectedDayEntries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} wsId={wsId} />
              ))}
            </List>
          )}
        </VStack>
      )}
    </VStack>
  );
}

// ─── Team Tab (Admin/Manager/HR) ─────────────────────────────────────────────

function TeamTab({ wsId, canManage }: { wsId: string; canManage: boolean }) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [activeClocks, setActiveClocks] = useState<ClockEntry[]>([]);
  const [rangeEntries, setRangeEntries] = useState<ClockEntry[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [clockingOutId, setClockingOutId] = useState<string | null>(null);

  const week = useMemo(() => getWeekRange(weekOffset), [weekOffset]);
  const monthRange = useMemo(() => getMonthRange(monthOffset), [monthOffset]);
  const range = viewMode === "week" ? week : monthRange;

  useEffect(() => subscribeToActiveClocks(wsId, setActiveClocks), [wsId]);
  useEffect(() => subscribeToMembers(wsId, setMembers), [wsId]);

  useEffect(() => {
    setLoading(true);
    getAttendanceByRange(wsId, range.start, range.end)
      .then(setRangeEntries)
      .finally(() => setLoading(false));
  }, [wsId, range.start.getTime(), range.end.getTime()]);

  useEffect(() => setSelectedDate(null), [weekOffset]);
  useEffect(() => setSelectedDate(null), [monthOffset]);
  useEffect(() => setSelectedDate(null), [viewMode]);

  const memberMap = useMemo(() => {
    const map = new Map<string, WorkspaceMember>();
    for (const m of members) map.set(m.userId, m);
    return map;
  }, [members]);

  const handleAdminClockOut = async (entry: ClockEntry) => {
    const member = memberMap.get(entry.userId);
    const name = member?.profile?.name ?? "this member";
    setClockingOutId(entry.id);
    try {
      await clockOut(wsId, entry.id, toDate(entry.clockIn), entry.breakMinutes);
      toast.success(`Clocked out ${name}`);
    } catch {
      toast.error(`Failed to clock out ${name}`);
    } finally {
      setClockingOutId(null);
    }
  };

  const filteredEntries = useMemo(() => {
    let filtered = rangeEntries;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => (memberMap.get(e.userId)?.profile?.name?.toLowerCase() ?? "").includes(q));
    }
    if (typeFilter !== "all") filtered = filtered.filter((e) => e.type === typeFilter);
    return filtered;
  }, [rangeEntries, searchQuery, typeFilter, memberMap]);

  const filteredActiveClocks = useMemo(() => {
    let filtered = activeClocks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => (memberMap.get(e.userId)?.profile?.name?.toLowerCase() ?? "").includes(q));
    }
    if (typeFilter !== "all") filtered = filtered.filter((e) => e.type === typeFilter);
    return filtered;
  }, [activeClocks, searchQuery, typeFilter, memberMap]);

  const weekDays: TeamDayData[] = useMemo(() => {
    if (viewMode !== "week") return [];
    const result: TeamDayData[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(week.start, i);
      const dayEntries = filteredEntries.filter((e) => isSameDay(toDate(e.clockIn), date));
      const totalHours = dayEntries.reduce((sum, e) => sum + (e.totalHours ?? 0), 0);
      const memberCount = new Set(dayEntries.map((e) => e.userId)).size;
      const hasOffice = dayEntries.some((e) => e.type === "office");
      const hasRemote = dayEntries.some((e) => e.type === "remote");
      result.push({ date, entries: dayEntries, totalHours, memberCount, hasOffice, hasRemote });
    }
    return result;
  }, [viewMode, week.start, filteredEntries]);

  const monthDays: TeamMonthDayData[] = useMemo(() => {
    if (viewMode !== "month") return [];
    const month = monthRange.start.getMonth();
    const year = monthRange.start.getFullYear();
    const lastDay = new Date(year, month + 1, 0);
    const firstDow = monthRange.start.getDay();
    const paddingBefore = (firstDow + 6) % 7;
    const gridStart = addDays(monthRange.start, -paddingBefore);
    const lastDow = lastDay.getDay();
    const paddingAfter = lastDow === 0 ? 0 : 7 - lastDow;
    const totalDays = paddingBefore + lastDay.getDate() + paddingAfter;

    const result: TeamMonthDayData[] = [];
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(gridStart, i);
      const isCurrentMonth = date.getMonth() === month && date.getFullYear() === year;
      const dayEntries = isCurrentMonth ? filteredEntries.filter((e) => isSameDay(toDate(e.clockIn), date)) : [];
      const totalHours = dayEntries.reduce((sum, e) => sum + (e.totalHours ?? 0), 0);
      const memberCount = new Set(dayEntries.map((e) => e.userId)).size;
      const hasOffice = dayEntries.some((e) => e.type === "office");
      const hasRemote = dayEntries.some((e) => e.type === "remote");
      result.push({ date, entries: dayEntries, totalHours, memberCount, hasOffice, hasRemote, isCurrentMonth });
    }
    return result;
  }, [viewMode, monthRange.start, filteredEntries]);

  const monthCurrentDays = useMemo(() => monthDays.filter((d) => d.isCurrentMonth), [monthDays]);

  const selectedDayMembers = useMemo(() => {
    if (!selectedDate) return [];
    const source = viewMode === "week" ? weekDays : monthDays;
    const day = source.find((d) => isSameDay(d.date, selectedDate));
    if (!day) return [];
    const grouped = new Map<string, { entries: ClockEntry[]; totalHours: number }>();
    for (const entry of day.entries) {
      const existing = grouped.get(entry.userId) ?? { entries: [], totalHours: 0 };
      existing.entries.push(entry);
      existing.totalHours += entry.totalHours ?? 0;
      grouped.set(entry.userId, existing);
    }
    return Array.from(grouped.entries()).map(([uid, data]) => ({ userId: uid, member: memberMap.get(uid), ...data }));
  }, [selectedDate, viewMode, weekDays, monthDays, memberMap]);

  const renderTeamExtra = useCallback(
    (day: TeamDayData | TeamMonthDayData) =>
      day.memberCount > 0 ? (
        <Text type="supporting" size="2xs" color="secondary">
          {day.memberCount} {day.memberCount === 1 ? "mbr" : "mbrs"}
        </Text>
      ) : null,
    []
  );

  return (
    <VStack gap={4}>
      {/* Who's In Now */}
      <Card>
        <VStack gap={3}>
          <HStack gap={2} align="center">
            <Users size={16} />
            <Text weight="semibold">Who&apos;s In Now</Text>
            {filteredActiveClocks.length > 0 && <Token label={String(filteredActiveClocks.length)} color="green" />}
          </HStack>
          {filteredActiveClocks.length === 0 ? (
            <Text type="supporting" color="secondary">
              No one is clocked in right now.
            </Text>
          ) : (
            <VStack gap={3}>
              {filteredActiveClocks.map((entry) => {
                const member = memberMap.get(entry.userId);
                return (
                  <HStack key={entry.id} justify="between" align="center">
                    <HStack gap={2} align="center">
                      <Avatar size="small" src={member?.profile?.avatarUrl ?? undefined} name={member?.profile?.name} />
                      <Text weight="medium">{member?.profile?.name ?? "Unknown"}</Text>
                    </HStack>
                    <HStack gap={2} align="center">
                      <Token
                        label={entry.type === "office" ? "Office" : "Remote"}
                        icon={entry.type === "office" ? <Building2 size={12} /> : <Wifi size={12} />}
                      />
                      <LiveTimer clockInTime={toDate(entry.clockIn)} />
                      {canManage && (
                        <Button
                          label="Stop"
                          variant="ghost"
                          size="sm"
                          icon={<LogOut size={12} />}
                          isLoading={clockingOutId === entry.id}
                          onClick={() => handleAdminClockOut(entry)}
                        />
                      )}
                    </HStack>
                  </HStack>
                );
              })}
            </VStack>
          )}
        </VStack>
      </Card>

      {/* Filters + View Toggle */}
      <HStack gap={3} wrap="wrap" align="center">
        <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        <TextInput
          label="Search members"
          isLabelHidden
          placeholder="Search members..."
          startIcon={Search}
          value={searchQuery}
          onChange={setSearchQuery}
        />
        <SegmentedControl label="Filter by type" value={typeFilter} onChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SegmentedControlItem value="all" label="All" />
          <SegmentedControlItem value="office" label="Office" />
          <SegmentedControlItem value="remote" label="Remote" />
        </SegmentedControl>
      </HStack>

      {/* Period Navigator */}
      <PeriodNavigator
        offset={viewMode === "week" ? weekOffset : monthOffset}
        setOffset={viewMode === "week" ? setWeekOffset : setMonthOffset}
        label={viewMode === "week" ? week.label : monthRange.label}
        viewMode={viewMode}
      />

      {/* Calendar Grid */}
      {loading ? (
        <Skeleton height={220} radius={2} />
      ) : viewMode === "week" ? (
        <>
          <WeekCalendarGrid days={weekDays} selectedDate={selectedDate} onSelectDate={setSelectedDate} renderExtra={renderTeamExtra} />
          <PeriodTotals days={weekDays} hoursLabel="Team hours" />
        </>
      ) : (
        <>
          <MonthCalendarGrid days={monthDays} selectedDate={selectedDate} onSelectDate={setSelectedDate} renderExtra={renderTeamExtra} />
          <PeriodTotals days={monthCurrentDays} hoursLabel="Team hours" />
        </>
      )}

      {/* Expanded Day: Per-member breakdown */}
      {selectedDate && (
        <VStack gap={2}>
          <Heading level={4}>{format(selectedDate, "EEEE, MMM d")}</Heading>
          {selectedDayMembers.length === 0 ? (
            <EmptyState title="No entries for this day" isCompact />
          ) : (
            <List hasDividers>
              {selectedDayMembers.map(({ userId, member, entries: memberEntries, totalHours }) => (
                <ListItem
                  key={userId}
                  label={member?.profile?.name ?? "Unknown"}
                  startContent={<Avatar size="small" src={member?.profile?.avatarUrl ?? undefined} name={member?.profile?.name} />}
                  description={memberEntries
                    .map((entry) => `${formatTime(toDate(entry.clockIn))} – ${entry.clockOut ? formatTime(toDate(entry.clockOut)) : "In progress"}`)
                    .join(" · ")}
                  endContent={
                    <HStack gap={2} align="center">
                      {memberEntries.some((e) => e.type === "office") && <Token label="Office" icon={<Building2 size={12} />} />}
                      {memberEntries.some((e) => e.type === "remote") && <Token label="Remote" icon={<Wifi size={12} />} />}
                      <Text weight="medium" hasTabularNumbers>
                        {formatDuration(totalHours)}
                      </Text>
                    </HStack>
                  }
                />
              ))}
            </List>
          )}
        </VStack>
      )}
    </VStack>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function useIpCheck(workspaceId: string | undefined, hasRestriction: boolean) {
  const [allowed, setAllowed] = useState(!hasRestriction);
  const [loading, setLoading] = useState(hasRestriction);

  useEffect(() => {
    if (!hasRestriction || !workspaceId) {
      setAllowed(true);
      setLoading(false);
      return;
    }
    const checkAccess = httpsCallable<{ workspaceId: string }, { allowed: boolean; ip: string }>(functions, "checkTimesheetAccess");

    checkAccess({ workspaceId })
      .then((result) => setAllowed(result.data.allowed))
      .catch(() => setAllowed(false))
      .finally(() => setLoading(false));
  }, [workspaceId, hasRestriction]);

  return { allowed, loading };
}

export default function TimesheetPage() {
  const { workspace, role, user } = useAuthStore();
  const { allowed: officeAllowed, loading: ipLoading } = useIpCheck(workspace?.id, !!workspace?.allowedTimesheetIp);
  const [activeTab, setActiveTab] = useState<"my" | "team">("my");

  const canViewTeam = role === "admin" || role === "manager" || role === "hr";

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <HStack justify="between" align="center" paddingInline={4} paddingBlock={3}>
            <VStack gap={0}>
              <Heading level={1}>Timesheet</Heading>
              <Text type="supporting" color="secondary">
                Track your work hours and attendance
              </Text>
            </VStack>
          </HStack>
        </LayoutHeader>
      }
    >
      <LayoutContent padding={4}>
        {!workspace || !user ? (
          <VStack gap={4} maxWidth={860}>
            <Skeleton height={220} radius={2} />
          </VStack>
        ) : (
          <VStack gap={4} maxWidth={860}>
            {workspace.allowedTimesheetIp && !ipLoading && !officeAllowed && (
              <Banner
                status="warning"
                title="Office clock-in restricted"
                description="Your current network isn't the authorized office network — office clock-in is disabled, remote clock-in is still available."
              />
            )}

            {canViewTeam ? (
              <TabList value={activeTab} onChange={(v) => setActiveTab(v as "my" | "team")}>
                <Tab value="my" label="My Timesheet" icon={<LogIn size={14} />} />
                <Tab value="team" label="Team" icon={<Users size={14} />} />
              </TabList>
            ) : null}

            {activeTab === "my" || !canViewTeam ? (
              <MyTimesheetTab wsId={workspace.id} userId={user.uid} officeAllowed={officeAllowed} />
            ) : (
              <TeamTab wsId={workspace.id} canManage={role === "admin" || role === "manager"} />
            )}
          </VStack>
        )}
      </LayoutContent>
    </Layout>
  );
}
