import { useEffect, useState } from "react";
import type { CalendarEvent, EventRegistration } from "@/lib/types";
import { subscribeToRegistrations } from "@/lib/firestore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";

interface RegistrationTableProps {
  wsId: string;
  event: CalendarEvent;
}

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (
    typeof val === "object" &&
    "toDate" in (val as Record<string, unknown>)
  )
    return (val as { toDate: () => Date }).toDate();
  return new Date(val as string);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function RegistrationTable({
  wsId,
  event,
}: RegistrationTableProps) {
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToRegistrations(
      wsId,
      event.id,
      setRegistrations
    );
    return unsubscribe;
  }, [wsId, event.id]);

  const handleExportCsv = () => {
    const headers = [
      ...event.registrationFields.map((f) => f.label),
      "Registered At",
    ];

    const rows = registrations.map((reg) => [
      ...event.registrationFields.map((f) =>
        escapeCsvField(reg.data[f.name] ?? "")
      ),
      escapeCsvField(formatDate(toDate(reg.registeredAt))),
    ]);

    const csvContent = [
      headers.map(escapeCsvField).join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.title.replace(/[^a-z0-9]/gi, "_")}_registrations.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Registrations</span>
          <Badge variant="secondary">{registrations.length}</Badge>
        </div>
        {registrations.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      {registrations.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No registrations yet
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {event.registrationFields.map((field) => (
                  <TableHead key={field.name}>{field.label}</TableHead>
                ))}
                <TableHead>Registered At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((reg) => (
                <TableRow key={reg.id}>
                  {event.registrationFields.map((field) => (
                    <TableCell key={field.name}>
                      {reg.data[field.name] ?? ""}
                    </TableCell>
                  ))}
                  <TableCell>
                    {formatDate(toDate(reg.registeredAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
