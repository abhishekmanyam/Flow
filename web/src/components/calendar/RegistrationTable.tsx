import { useEffect, useState } from "react";
import { Download, Users } from "lucide-react";
import type { CalendarEvent, EventRegistration } from "@/lib/types";
import { subscribeToRegistrations } from "@/lib/firestore";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Spinner } from "@astryxdesign/core/Spinner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Banner } from "@astryxdesign/core/Banner";
import { Center } from "@astryxdesign/core/Center";
import { Table, proportional } from "@astryxdesign/core/Table";

interface RegistrationTableProps {
  wsId: string;
  event: CalendarEvent;
}

interface RegistrationRow extends Record<string, unknown> {
  __id: string;
  __registeredAt: string;
}

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === "object" && "toDate" in (val as Record<string, unknown>))
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      const unsubscribe = subscribeToRegistrations(wsId, event.id, (data) => {
        setRegistrations(data);
        setLoading(false);
      });
      return unsubscribe;
    } catch {
      setError("Failed to load registrations");
      setLoading(false);
    }
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

  const columns = [
    ...event.registrationFields.map((f) => ({
      key: f.name,
      header: f.label,
      width: proportional(1),
    })),
    { key: "__registeredAt", header: "Registered At", width: proportional(1) },
  ];

  const rows: RegistrationRow[] = registrations.map((reg) => {
    const row: RegistrationRow = {
      __id: reg.id,
      __registeredAt: formatDate(toDate(reg.registeredAt)),
    };
    for (const f of event.registrationFields) {
      row[f.name] = reg.data[f.name] ?? "";
    }
    return row;
  });

  return (
    <VStack gap={4}>
      <HStack justify="between" align="center">
        <HStack gap={2} align="center">
          <Text weight="medium">Registrations</Text>
          <Badge label={String(registrations.length)} />
        </HStack>
        {registrations.length > 0 && (
          <Button
            label="Export CSV"
            variant="secondary"
            size="sm"
            icon={<Download size={16} />}
            onClick={handleExportCsv}
          />
        )}
      </HStack>

      {error ? (
        <Banner status="error" title={error} />
      ) : loading ? (
        <Center height={120}>
          <Spinner label="Loading registrations" />
        </Center>
      ) : registrations.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title="No registrations yet"
          description="Registrations will appear here once people sign up."
          isCompact
        />
      ) : (
        <Table
          data={rows}
          columns={columns}
          idKey="__id"
          density="compact"
          hasHover
        />
      )}
    </VStack>
  );
}
