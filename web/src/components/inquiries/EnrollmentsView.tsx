import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Trash2, Mail, Phone, Eye } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import {
  subscribeToEnrollments,
  updateEnrollmentStatus,
  updateEnrollmentNotes,
  deleteEnrollment,
} from "@/lib/firestore";
import { toast } from "@/components/system/toast";
import {
  CAMP_REG_STATUS_LABELS,
  ENROLLMENT_PLAN_LABELS,
  type Enrollment,
  type EnrollmentPlan,
  type EnrollmentStatus,
} from "@/lib/types";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Grid } from "@astryxdesign/core/Grid";
import { Center } from "@astryxdesign/core/Center";
import { Card } from "@astryxdesign/core/Card";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Token } from "@astryxdesign/core/Token";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { Spinner } from "@astryxdesign/core/Spinner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import {
  Layout,
  LayoutContent,
  LayoutFooter,
} from "@astryxdesign/core/Layout";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import {
  Table,
  TableRow,
  TableCell,
  TableHeaderCell,
} from "@astryxdesign/core/Table";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";

const STATUSES: EnrollmentStatus[] = ["new", "contacted", "confirmed", "cancelled"];
const PLANS: EnrollmentPlan[] = ["explorer", "innovator", "visionary"];

type TokenColor = "blue" | "orange" | "green" | "gray";
const STATUS_TOKEN_COLOR: Record<EnrollmentStatus, TokenColor> = {
  new: "blue",
  contacted: "orange",
  confirmed: "green",
  cancelled: "gray",
};

function toCsvCell(v: string | number | undefined): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCsv(rows: Enrollment[]) {
  const header = [
    "Child Name", "Age", "Parent", "Email", "Phone", "Plan",
    "Status", "Notes", "Source", "Submitted",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.childName, r.childAge, r.parentName, r.parentEmail, r.parentPhone,
        ENROLLMENT_PLAN_LABELS[r.plan], r.status, r.notes ?? "", r.source,
        r.createdAt?.toDate ? format(r.createdAt.toDate(), "yyyy-MM-dd HH:mm") : "",
      ]
        .map(toCsvCell)
        .join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `enrollments-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EnrollmentsView() {
  const { workspace } = useAuthStore();
  const [items, setItems] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | "all">("all");
  const [planFilter, setPlanFilter] = useState<EnrollmentPlan | "all">("all");
  const [selected, setSelected] = useState<Enrollment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => {
    if (!workspace) return;
    setLoading(true);
    return subscribeToEnrollments(workspace.id, (data) => {
      setItems(data);
      setLoading(false);
    });
  }, [workspace?.id]);

  useEffect(() => {
    setNotesDraft(selected?.notes ?? "");
  }, [selected?.id]);

  const filtered = useMemo(
    () =>
      items.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (planFilter !== "all" && r.plan !== planFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          const haystack =
            `${r.childName} ${r.parentName} ${r.parentEmail} ${r.parentPhone}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      }),
    [items, search, statusFilter, planFilter]
  );

  const counts = useMemo(
    () => ({
      total: items.length,
      new: items.filter((r) => r.status === "new").length,
      confirmed: items.filter((r) => r.status === "confirmed").length,
    }),
    [items]
  );

  const handleStatusChange = async (id: string, status: EnrollmentStatus) => {
    if (!workspace) return;
    setSelected((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
    try {
      await updateEnrollmentStatus(workspace.id, id, status);
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleSaveNotes = async () => {
    if (!workspace || !selected) return;
    try {
      await updateEnrollmentNotes(workspace.id, selected.id, notesDraft);
      toast.success("Notes saved");
      setSelected(null);
    } catch {
      toast.error("Failed to save notes");
    }
  };

  const handleDelete = async () => {
    if (!workspace || !deleteId) return;
    try {
      await deleteEnrollment(workspace.id, deleteId);
      toast.success("Deleted");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <VStack gap={4}>
      <VStack gap={4} paddingInline={4} paddingBlock={4}>
        <Grid columns={{ minWidth: 160, max: 3 }} gap={3}>
          <Card>
            <Text type="supporting">Total</Text>
            <Heading level={2}>{counts.total}</Heading>
          </Card>
          <Card>
            <Text type="supporting">New</Text>
            <Heading level={2}>{counts.new}</Heading>
          </Card>
          <Card>
            <Text type="supporting">Confirmed</Text>
            <Heading level={2}>{counts.confirmed}</Heading>
          </Card>
        </Grid>

        <HStack gap={3} wrap="wrap" align="end" justify="between">
          <HStack gap={3} wrap="wrap" align="end">
            <TextInput
              label="Search"
              isLabelHidden
              placeholder="Search name, email, phone…"
              startIcon="search"
              hasClear
              value={search}
              onChange={setSearch}
              width={260}
            />
            <Selector
              label="Status"
              isLabelHidden
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as EnrollmentStatus | "all")}
              options={[
                { value: "all", label: "All statuses" },
                ...STATUSES.map((s) => ({ value: s, label: CAMP_REG_STATUS_LABELS[s] })),
              ]}
            />
            <Selector
              label="Plan"
              isLabelHidden
              value={planFilter}
              onChange={(v) => setPlanFilter(v as EnrollmentPlan | "all")}
              options={[
                { value: "all", label: "All plans" },
                ...PLANS.map((p) => ({ value: p, label: ENROLLMENT_PLAN_LABELS[p] })),
              ]}
            />
          </HStack>
          <Button
            label="Export CSV"
            variant="secondary"
            icon={<Download size={16} />}
            isDisabled={filtered.length === 0}
            onClick={() => exportCsv(filtered)}
          />
        </HStack>
      </VStack>

      {loading ? (
        <Center axis="horizontal" height={200}>
          <Spinner label="Loading enrollments…" />
        </Center>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No enrollments"
          description="No enrollments match the current filters."
        />
      ) : (
        <Table hasHover dividers="rows">
          <TableRow>
            <TableHeaderCell>Child</TableHeaderCell>
            <TableHeaderCell>Parent</TableHeaderCell>
            <TableHeaderCell>Contact</TableHeaderCell>
            <TableHeaderCell>Plan</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Submitted</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <VStack gap={0}>
                  <Text weight="medium">{r.childName}</Text>
                  <Text type="supporting">Age {r.childAge}</Text>
                </VStack>
              </TableCell>
              <TableCell>
                <Text>{r.parentName}</Text>
              </TableCell>
              <TableCell>
                <VStack gap={0.5}>
                  <HStack gap={1} align="center">
                    <Icon icon={Mail} size="xsm" color="secondary" />
                    <Text type="supporting">{r.parentEmail}</Text>
                  </HStack>
                  <HStack gap={1} align="center">
                    <Icon icon={Phone} size="xsm" color="secondary" />
                    <Text type="supporting">{r.parentPhone}</Text>
                  </HStack>
                </VStack>
              </TableCell>
              <TableCell>
                <Text>{ENROLLMENT_PLAN_LABELS[r.plan]}</Text>
              </TableCell>
              <TableCell>
                <Token
                  label={CAMP_REG_STATUS_LABELS[r.status]}
                  color={STATUS_TOKEN_COLOR[r.status]}
                  size="sm"
                />
              </TableCell>
              <TableCell>
                {r.createdAt?.toDate ? (
                  <Timestamp
                    value={r.createdAt.toDate().toISOString()}
                    format="date_time"
                  />
                ) : (
                  <Text type="supporting">—</Text>
                )}
              </TableCell>
              <TableCell>
                <HStack gap={1}>
                  <IconButton
                    label="View details"
                    variant="ghost"
                    size="sm"
                    icon={<Eye size={16} />}
                    onClick={() => setSelected(r)}
                  />
                  <IconButton
                    label="Delete"
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={16} />}
                    onClick={() => setDeleteId(r.id)}
                  />
                </HStack>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      )}

      {/* Detail dialog */}
      <Dialog
        isOpen={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        width={560}
        purpose="form"
      >
        {selected && (
          <Layout
            header={
              <DialogHeader
                title={selected.childName}
                onOpenChange={(o) => !o && setSelected(null)}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={5}>
                  <MetadataList columns="multi">
                    <MetadataListItem label="Age">{`${selected.childAge}`}</MetadataListItem>
                    <MetadataListItem label="Plan">
                      {ENROLLMENT_PLAN_LABELS[selected.plan]}
                    </MetadataListItem>
                    <MetadataListItem label="Parent">{selected.parentName}</MetadataListItem>
                    <MetadataListItem label="Phone">{selected.parentPhone}</MetadataListItem>
                    <MetadataListItem label="Email">{selected.parentEmail}</MetadataListItem>
                    <MetadataListItem label="Submitted">
                      {selected.createdAt?.toDate
                        ? format(selected.createdAt.toDate(), "MMM d, yyyy · h:mm a")
                        : "—"}
                    </MetadataListItem>
                  </MetadataList>

                  <Selector
                    label="Status"
                    value={selected.status}
                    onChange={(v) =>
                      handleStatusChange(selected.id, v as EnrollmentStatus)
                    }
                    options={STATUSES.map((s) => ({
                      value: s,
                      label: CAMP_REG_STATUS_LABELS[s],
                    }))}
                  />

                  <TextArea
                    label="Notes"
                    placeholder="Internal notes…"
                    rows={4}
                    value={notesDraft}
                    onChange={setNotesDraft}
                  />
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter>
                <HStack gap={2} hAlign="end">
                  <Button
                    label="Close"
                    variant="secondary"
                    onClick={() => setSelected(null)}
                  />
                  <Button
                    label="Save notes"
                    variant="primary"
                    onClick={handleSaveNotes}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        )}
      </Dialog>

      <AlertDialog
        isOpen={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete enrollment?"
        description="This cannot be undone."
        actionLabel="Delete"
        onAction={handleDelete}
      />
    </VStack>
  );
}
