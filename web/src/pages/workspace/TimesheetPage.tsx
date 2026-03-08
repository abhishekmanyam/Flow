import { useEffect, useState, useMemo, useCallback } from "react";
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
import { ShieldAlert } from "lucide-react";
import { MotionPage } from "@/components/ui/motion-page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { toast } from "sonner";
import {
  Building2,
  Wifi,
  LogIn,
  LogOut,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  Search,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";
import { addDays, isSameDay, isToday, format } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = "week" | "month";

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

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s/)
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

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

  // Pad to Monday start
  const firstDow = monthStart.getDay(); // 0=Sun
  const paddingBefore = (firstDow + 6) % 7;
  const gridStart = addDays(monthStart, -paddingBefore);

  // Pad to Sunday end
  const lastDow = lastDay.getDay();
  const paddingAfter = lastDow === 0 ? 0 : 7 - lastDow;
  const totalDays = paddingBefore + lastDay.getDate() + paddingAfter;

  const days: MonthDayData[] = [];
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(gridStart, i);
    const isCurrentMonth = date.getMonth() === month && date.getFullYear() === year;
    const dayEntries = isCurrentMonth
      ? entries.filter((e) => isSameDay(toDate(e.clockIn), date))
      : [];
    const totalHours = dayEntries.reduce((sum, e) => sum + (e.totalHours ?? 0), 0);
    const hasOffice = dayEntries.some((e) => e.type === "office");
    const hasRemote = dayEntries.some((e) => e.type === "remote");
    days.push({ date, entries: dayEntries, totalHours, hasOffice, hasRemote, isCurrentMonth });
  }
  return days;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CLOCK_HOURS = 8;

// ─── Live Timer ──────────────────────────────────────────────────────────────

function LiveTimer({ clockInTime }: { clockInTime: Date }) {
  const [elapsed, setElapsed] = useState(() => getElapsedHours(clockInTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsedHours(clockInTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [clockInTime]);

  const h = Math.floor(elapsed);
  const m = Math.floor((elapsed - h) * 60);
  const s = Math.floor(((elapsed - h) * 60 - m) * 60);

  const remaining = Math.max(0, MAX_CLOCK_HOURS - elapsed);
  const remH = Math.floor(remaining);
  const remM = Math.floor((remaining - remH) * 60);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-2xl font-bold tabular-nums">
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
      {remaining > 0 && remaining < MAX_CLOCK_HOURS && (
        <span className="text-xs text-muted-foreground">
          Auto clock-out in {remH > 0 ? `${remH}h ` : ""}{remM}m
        </span>
      )}
    </div>
  );
}

function ShiftProgress({ clockInTime }: { clockInTime: Date }) {
  const [pct, setPct] = useState(() =>
    Math.min(100, (getElapsedHours(clockInTime) / MAX_CLOCK_HOURS) * 100)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setPct(Math.min(100, (getElapsedHours(clockInTime) / MAX_CLOCK_HOURS) * 100));
    }, 10_000); // update every 10s is enough for a bar
    return () => clearInterval(interval);
  }, [clockInTime]);

  const isWarning = pct >= 75;

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{Math.round(pct)}% of {MAX_CLOCK_HOURS}h shift</span>
        {isWarning && (
          <span className="flex items-center gap-1 text-amber-500">
            <AlertTriangle className="h-3 w-3" />
            {pct >= 100 ? "Limit reached" : "Nearing limit"}
          </span>
        )}
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
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

  // Auto clock-out after MAX_CLOCK_HOURS
  useEffect(() => {
    if (!activeEntry) return;
    const clockInTime = toDate(activeEntry.clockIn);
    const elapsed = getElapsedHours(clockInTime);

    // Already past the limit — clock out immediately
    if (elapsed >= MAX_CLOCK_HOURS) {
      clockOut(wsId, activeEntry.id, clockInTime, activeEntry.breakMinutes).then(() => {
        toast.info("Auto clocked out after 8 hours. Please clock in again to continue.");
      });
      return;
    }

    // Schedule clock-out at the exact moment the limit is reached
    const remainingMs = (MAX_CLOCK_HOURS - elapsed) * 60 * 60 * 1000;
    const timer = setTimeout(() => {
      clockOut(wsId, activeEntry.id, clockInTime, activeEntry.breakMinutes).then(() => {
        toast.info("Auto clocked out after 8 hours. Please clock in again to continue.");
      });
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [activeEntry, wsId]);

  const handleClockIn = async (type: "office" | "remote") => {
    if (activeEntry) return; // already clocked in
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
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="pt-6 space-y-5">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-green-500 animate-pulse" />
            </div>
            <LiveTimer clockInTime={toDate(activeEntry.clockIn)} />
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 capitalize">
                {activeEntry.type === "office" ? (
                  <Building2 className="h-3 w-3" />
                ) : (
                  <Wifi className="h-3 w-3" />
                )}
                {activeEntry.type}
              </Badge>
              <span className="text-xs text-muted-foreground">
                since {formatTime(toDate(activeEntry.clockIn))}
              </span>
            </div>
          </div>
          <ShiftProgress clockInTime={toDate(activeEntry.clockIn)} />
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleClockOut}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            Clock Out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => handleClockIn("office")}
        disabled={loading || !officeAllowed}
        className={cn(
          "relative flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 transition-all",
          "hover:border-primary hover:bg-primary/5",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent",
        )}
      >
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-blue-500" />
          </div>
        )}
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">Office</p>
          <p className="text-xs text-muted-foreground">Clock in from office</p>
        </div>
        {!officeAllowed && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldAlert className="h-3 w-3" />
            <span>Requires authorized network</span>
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={() => handleClockIn("remote")}
        disabled={loading}
        className={cn(
          "relative flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 transition-all",
          "hover:border-primary hover:bg-primary/5",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <Wifi className="h-6 w-6 text-green-500" />
          </div>
        )}
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">Remote</p>
          <p className="text-xs text-muted-foreground">Clock in from home</p>
        </div>
      </button>
    </div>
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
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">
            {formatTime(clockInDate)}
            {" – "}
            {clockOutDate ? formatTime(clockOutDate) : "In progress"}
          </span>
          <Badge variant="outline" className="gap-1 capitalize text-xs">
            {entry.type === "office" ? (
              <Building2 className="h-2.5 w-2.5" />
            ) : (
              <Wifi className="h-2.5 w-2.5" />
            )}
            {entry.type}
          </Badge>
          {entry.totalHours != null && (
            <span className="text-xs text-muted-foreground">
              {formatDuration(entry.totalHours)}
            </span>
          )}
        </div>
        <Input
          placeholder="Add notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}

// ─── Shared UI Components ────────────────────────────────────────────────────

function ViewModeToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={(v) => { if (v) onViewModeChange(v as ViewMode); }}
    >
      <ToggleGroupItem value="week" className="text-xs h-8 px-3 gap-1.5">
        <Calendar className="h-3.5 w-3.5" />
        Week
      </ToggleGroupItem>
      <ToggleGroupItem value="month" className="text-xs h-8 px-3 gap-1.5">
        <CalendarDays className="h-3.5 w-3.5" />
        Month
      </ToggleGroupItem>
    </ToggleGroup>
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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOffset((o) => o - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setOffset(0)}
          disabled={offset === 0}
        >
          {viewMode === "week" ? "This week" : "This month"}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOffset((o) => o + 1)}
          disabled={offset >= 0}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function PeriodTotals({
  days,
  hoursLabel = "Total hours",
}: {
  days: DayData[];
  hoursLabel?: string;
}) {
  const totalHours = days.reduce((sum, d) => sum + d.totalHours, 0);
  const officeDays = days.filter((d) => d.hasOffice).length;
  const remoteDays = days.filter((d) => d.hasRemote).length;

  return (
    <div className="flex gap-6 rounded-lg border p-3">
      <div>
        <p className="text-lg font-bold">{formatDuration(totalHours)}</p>
        <p className="text-xs text-muted-foreground">{hoursLabel}</p>
      </div>
      <div>
        <p className="text-lg font-bold">{officeDays}</p>
        <p className="text-xs text-muted-foreground">Office days</p>
      </div>
      <div>
        <p className="text-lg font-bold">{remoteDays}</p>
        <p className="text-xs text-muted-foreground">Remote days</p>
      </div>
      <div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-blue-500" /> Office
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-green-500" /> Remote
        </span>
      </div>
    </div>
  );
}

// ─── Week Calendar Grid ──────────────────────────────────────────────────────

function WeekCalendarGrid({
  days,
  selectedDate,
  onSelectDate,
}: {
  days: DayData[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {DAY_LABELS.map((label) => (
        <div
          key={label}
          className="text-center text-xs font-medium text-muted-foreground pb-1"
        >
          {label}
        </div>
      ))}
      {days.map((day) => {
        const selected = selectedDate && isSameDay(day.date, selectedDate);
        const today = isToday(day.date);
        return (
          <button
            key={day.date.toISOString()}
            type="button"
            onClick={() => onSelectDate(selected ? null : day.date)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors hover:bg-accent",
              today && "border-primary",
              selected && "bg-accent ring-1 ring-primary",
              day.entries.length === 0 && "opacity-60"
            )}
          >
            <span className="text-xs font-medium">{format(day.date, "d")}</span>
            {day.totalHours > 0 && (
              <span className="text-xs font-semibold tabular-nums">
                {formatDuration(day.totalHours)}
              </span>
            )}
            {(day.hasOffice || day.hasRemote) && (
              <div className="flex gap-1">
                {day.hasOffice && <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                {day.hasRemote && <div className="h-1.5 w-1.5 rounded-full bg-green-500" />}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Month Calendar Grid ─────────────────────────────────────────────────────

function MonthCalendarGrid({
  days,
  selectedDate,
  onSelectDate,
  renderExtra,
}: {
  days: MonthDayData[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  renderExtra?: (day: MonthDayData) => React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {DAY_LABELS.map((label) => (
        <div
          key={label}
          className="text-center text-xs font-medium text-muted-foreground pb-1"
        >
          {label}
        </div>
      ))}
      {days.map((day) => {
        const selected = selectedDate && isSameDay(day.date, selectedDate);
        const today = isToday(day.date);
        return (
          <button
            key={day.date.toISOString()}
            type="button"
            disabled={!day.isCurrentMonth}
            onClick={() => {
              if (!day.isCurrentMonth) return;
              onSelectDate(selected ? null : day.date);
            }}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-md border p-1.5 text-center transition-colors min-h-[3.5rem]",
              day.isCurrentMonth && "hover:bg-accent",
              !day.isCurrentMonth && "opacity-30 cursor-default",
              today && day.isCurrentMonth && "border-primary",
              selected && "bg-accent ring-1 ring-primary",
              day.isCurrentMonth && day.entries.length === 0 && "opacity-60"
            )}
          >
            <span className="text-xs font-medium">{format(day.date, "d")}</span>
            {day.isCurrentMonth && day.totalHours > 0 && (
              <span className="text-[10px] font-semibold tabular-nums">
                {formatDuration(day.totalHours)}
              </span>
            )}
            {day.isCurrentMonth && renderExtra?.(day)}
            {day.isCurrentMonth && (day.hasOffice || day.hasRemote) && (
              <div className="flex gap-0.5">
                {day.hasOffice && <div className="h-1 w-1 rounded-full bg-blue-500" />}
                {day.hasRemote && <div className="h-1 w-1 rounded-full bg-green-500" />}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── My Timesheet Tab ────────────────────────────────────────────────────────

function MyTimesheetTab({
  wsId,
  userId,
  officeAllowed,
}: {
  officeAllowed: boolean;
  wsId: string;
  userId: string;
}) {
  const [activeEntry, setActiveEntry] = useState<ClockEntry | null>(null);
  const [rangeEntries, setRangeEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Active entry via user-scoped real-time subscription (works for all roles)
  useEffect(() => {
    return subscribeToMyActiveClock(wsId, userId, setActiveEntry);
  }, [wsId, userId]);

  // Date ranges
  const week = useMemo(() => getWeekRange(weekOffset), [weekOffset]);
  const monthRange = useMemo(() => getMonthRange(monthOffset), [monthOffset]);
  const range = viewMode === "week" ? week : monthRange;

  // Fetch entries for the current range (same query as Team tab + client-side userId filter)
  useEffect(() => {
    setLoading(true);
    getAttendanceByRange(wsId, range.start, range.end)
      .then((all) => setRangeEntries(all.filter((e) => e.userId === userId)))
      .finally(() => setLoading(false));
  }, [wsId, userId, range.start.getTime(), range.end.getTime()]);

  // Build calendar days
  const weekDays = useMemo(
    () => (viewMode === "week" ? buildWeekDays(week.start, rangeEntries) : []),
    [viewMode, week.start, rangeEntries]
  );

  const monthDays = useMemo(
    () => (viewMode === "month" ? buildMonthGrid(monthRange.start, rangeEntries) : []),
    [viewMode, monthRange.start, rangeEntries]
  );

  const monthCurrentDays = useMemo(
    () => monthDays.filter((d) => d.isCurrentMonth),
    [monthDays]
  );

  // Selected day entries
  const selectedDayEntries = useMemo(() => {
    if (!selectedDate) return [];
    const source = viewMode === "week" ? weekDays : monthDays;
    const day = source.find((d) => isSameDay(d.date, selectedDate));
    return day?.entries ?? [];
  }, [selectedDate, viewMode, weekDays, monthDays]);

  // Reset selection on period/view change
  useEffect(() => { setSelectedDate(null); }, [weekOffset]);
  useEffect(() => { setSelectedDate(null); }, [monthOffset]);
  useEffect(() => { setSelectedDate(null); }, [viewMode]);

  return (
    <div className="space-y-4">
      <ClockCard wsId={wsId} userId={userId} activeEntry={activeEntry} officeAllowed={officeAllowed} />

      <div className="flex items-center justify-between">
        <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      <PeriodNavigator
        offset={viewMode === "week" ? weekOffset : monthOffset}
        setOffset={viewMode === "week" ? setWeekOffset : setMonthOffset}
        label={range.label}
        viewMode={viewMode}
      />

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === "week" ? (
        <>
          <WeekCalendarGrid
            days={weekDays}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <PeriodTotals days={weekDays} />
        </>
      ) : (
        <>
          <MonthCalendarGrid
            days={monthDays}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <PeriodTotals days={monthCurrentDays} />
        </>
      )}

      {selectedDate && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {format(selectedDate, "EEEE, MMM d")}
          </h3>
          {selectedDayEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No entries for this day.
            </p>
          ) : (
            selectedDayEntries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} wsId={wsId} />
            ))
          )}
        </div>
      )}
    </div>
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
  const [typeFilter, setTypeFilter] = useState("all");
  const [clockingOutId, setClockingOutId] = useState<string | null>(null);

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

  const week = useMemo(() => getWeekRange(weekOffset), [weekOffset]);
  const monthRange = useMemo(() => getMonthRange(monthOffset), [monthOffset]);

  const range = viewMode === "week" ? week : monthRange;

  useEffect(() => {
    return subscribeToActiveClocks(wsId, setActiveClocks);
  }, [wsId]);

  useEffect(() => {
    return subscribeToMembers(wsId, setMembers);
  }, [wsId]);

  useEffect(() => {
    setLoading(true);
    getAttendanceByRange(wsId, range.start, range.end)
      .then(setRangeEntries)
      .finally(() => setLoading(false));
  }, [wsId, range.start.getTime(), range.end.getTime()]);

  // Reset selection on period/view change
  useEffect(() => { setSelectedDate(null); }, [weekOffset]);
  useEffect(() => { setSelectedDate(null); }, [monthOffset]);
  useEffect(() => { setSelectedDate(null); }, [viewMode]);

  // Build member lookup
  const memberMap = useMemo(() => {
    const map = new Map<string, WorkspaceMember>();
    for (const m of members) map.set(m.userId, m);
    return map;
  }, [members]);

  // Filter entries by search + type
  const filteredEntries = useMemo(() => {
    let filtered = rangeEntries;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => {
        const member = memberMap.get(e.userId);
        const name = member?.profile?.name?.toLowerCase() ?? "";
        return name.includes(q);
      });
    }
    if (typeFilter !== "all") {
      filtered = filtered.filter((e) => e.type === typeFilter);
    }
    return filtered;
  }, [rangeEntries, searchQuery, typeFilter, memberMap]);

  // Filter active clocks for consistency
  const filteredActiveClocks = useMemo(() => {
    let filtered = activeClocks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => {
        const member = memberMap.get(e.userId);
        const name = member?.profile?.name?.toLowerCase() ?? "";
        return name.includes(q);
      });
    }
    if (typeFilter !== "all") {
      filtered = filtered.filter((e) => e.type === typeFilter);
    }
    return filtered;
  }, [activeClocks, searchQuery, typeFilter, memberMap]);

  // Week view days
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

  // Month view days
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
      const dayEntries = isCurrentMonth
        ? filteredEntries.filter((e) => isSameDay(toDate(e.clockIn), date))
        : [];
      const totalHours = dayEntries.reduce((sum, e) => sum + (e.totalHours ?? 0), 0);
      const memberCount = new Set(dayEntries.map((e) => e.userId)).size;
      const hasOffice = dayEntries.some((e) => e.type === "office");
      const hasRemote = dayEntries.some((e) => e.type === "remote");
      result.push({ date, entries: dayEntries, totalHours, memberCount, hasOffice, hasRemote, isCurrentMonth });
    }
    return result;
  }, [viewMode, monthRange.start, filteredEntries]);

  const monthCurrentDays = useMemo(
    () => monthDays.filter((d) => d.isCurrentMonth),
    [monthDays]
  );

  // Selected day member breakdown
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
    return Array.from(grouped.entries()).map(([uid, data]) => ({
      userId: uid,
      member: memberMap.get(uid),
      ...data,
    }));
  }, [selectedDate, viewMode, weekDays, monthDays, memberMap]);

  const renderTeamExtra = useCallback(
    (day: MonthDayData) => {
      const teamDay = day as TeamMonthDayData;
      if (!teamDay.memberCount) return null;
      return (
        <span className="text-[9px] text-muted-foreground">
          {teamDay.memberCount}{teamDay.memberCount === 1 ? " mbr" : " mbrs"}
        </span>
      );
    },
    []
  );

  return (
    <div className="space-y-4">
      {/* Who's In Now */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-green-500" />
            Who&apos;s In Now
            {filteredActiveClocks.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {filteredActiveClocks.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredActiveClocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one is clocked in right now.</p>
          ) : (
            <div className="space-y-3">
              {filteredActiveClocks.map((entry) => {
                const member = memberMap.get(entry.userId);
                return (
                  <div key={entry.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={member?.profile?.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member?.profile?.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {member?.profile?.name ?? "Unknown"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1 capitalize text-xs">
                        {entry.type === "office" ? (
                          <Building2 className="h-2.5 w-2.5" />
                        ) : (
                          <Wifi className="h-2.5 w-2.5" />
                        )}
                        {entry.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        <LiveTimer clockInTime={toDate(entry.clockIn)} />
                      </span>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          disabled={clockingOutId === entry.id}
                          onClick={() => handleAdminClockOut(entry)}
                        >
                          {clockingOutId === entry.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <LogOut className="h-3 w-3 mr-1" />
                              Stop
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters + View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <ToggleGroup
          type="single"
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v || "all")}
        >
          <ToggleGroupItem value="all" className="text-xs h-9 px-3">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="office" className="text-xs h-9 px-3">
            <Building2 className="mr-1 h-3 w-3" />
            Office
          </ToggleGroupItem>
          <ToggleGroupItem value="remote" className="text-xs h-9 px-3">
            <Wifi className="mr-1 h-3 w-3" />
            Remote
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Period Navigator */}
      {viewMode === "week" ? (
        <PeriodNavigator
          offset={weekOffset}
          setOffset={setWeekOffset}
          label={week.label}
          viewMode="week"
        />
      ) : (
        <PeriodNavigator
          offset={monthOffset}
          setOffset={setMonthOffset}
          label={monthRange.label}
          viewMode="month"
        />
      )}

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === "week" ? (
        <>
          {/* Week grid with member counts */}
          <div className="grid grid-cols-7 gap-2">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-center text-xs font-medium text-muted-foreground pb-1"
              >
                {label}
              </div>
            ))}
            {weekDays.map((day) => {
              const selected = selectedDate && isSameDay(day.date, selectedDate);
              const today = isToday(day.date);
              return (
                <button
                  key={day.date.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(selected ? null : day.date)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors hover:bg-accent",
                    today && "border-primary",
                    selected && "bg-accent ring-1 ring-primary",
                    day.entries.length === 0 && "opacity-60"
                  )}
                >
                  <span className="text-xs font-medium">{format(day.date, "d")}</span>
                  {day.totalHours > 0 && (
                    <span className="text-xs font-semibold tabular-nums">
                      {formatDuration(day.totalHours)}
                    </span>
                  )}
                  {day.memberCount > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {day.memberCount} {day.memberCount === 1 ? "member" : "members"}
                    </span>
                  )}
                  {(day.hasOffice || day.hasRemote) && (
                    <div className="flex gap-1">
                      {day.hasOffice && <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                      {day.hasRemote && <div className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <PeriodTotals days={weekDays} hoursLabel="Team hours" />
        </>
      ) : (
        <>
          <MonthCalendarGrid
            days={monthDays}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            renderExtra={renderTeamExtra}
          />
          <PeriodTotals days={monthCurrentDays} hoursLabel="Team hours" />
        </>
      )}

      {/* Expanded Day: Per-member breakdown */}
      {selectedDate && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {format(selectedDate, "EEEE, MMM d")}
          </h3>
          {selectedDayMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No entries for this day.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedDayMembers.map(({ userId, member, entries: memberEntries, totalHours }) => (
                <div
                  key={userId}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member?.profile?.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(member?.profile?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member?.profile?.name ?? "Unknown"}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {memberEntries.map((entry) => (
                        <span key={entry.id} className="text-xs text-muted-foreground">
                          {formatTime(toDate(entry.clockIn))}
                          {" – "}
                          {entry.clockOut
                            ? formatTime(toDate(entry.clockOut))
                            : "In progress"}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {memberEntries.some((e) => e.type === "office") && (
                        <Badge variant="outline" className="gap-1 capitalize text-xs">
                          <Building2 className="h-2.5 w-2.5" />
                          Office
                        </Badge>
                      )}
                      {memberEntries.some((e) => e.type === "remote") && (
                        <Badge variant="outline" className="gap-1 capitalize text-xs">
                          <Wifi className="h-2.5 w-2.5" />
                          Remote
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatDuration(totalHours)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
    const checkAccess = httpsCallable<
      { workspaceId: string },
      { allowed: boolean; ip: string }
    >(functions, "checkTimesheetAccess");

    checkAccess({ workspaceId })
      .then((result) => setAllowed(result.data.allowed))
      .catch(() => setAllowed(false))
      .finally(() => setLoading(false));
  }, [workspaceId, hasRestriction]);

  return { allowed, loading };
}

export default function TimesheetPage() {
  const { workspace, role, user } = useAuthStore();
  const { allowed: officeAllowed } = useIpCheck(
    workspace?.id,
    !!workspace?.allowedTimesheetIp
  );

  if (!workspace || !user) return null;

  const canViewTeam = role === "admin" || role === "manager" || role === "hr";

  return (
    <MotionPage className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Timesheet</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track your work hours and attendance
        </p>
      </div>

      <Tabs defaultValue="my-timesheet">
        <TabsList>
          <TabsTrigger value="my-timesheet">
            <LogIn className="mr-1.5 h-4 w-4" />
            My Timesheet
          </TabsTrigger>
          {canViewTeam && (
            <TabsTrigger value="team">
              <Users className="mr-1.5 h-4 w-4" />
              Team
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my-timesheet" className="mt-4">
          <MyTimesheetTab wsId={workspace.id} userId={user.uid} officeAllowed={officeAllowed} />
        </TabsContent>

        {canViewTeam && (
          <TabsContent value="team" className="mt-4">
            <TeamTab wsId={workspace.id} canManage={role === "admin" || role === "manager"} />
          </TabsContent>
        )}
      </Tabs>
    </MotionPage>
  );
}
