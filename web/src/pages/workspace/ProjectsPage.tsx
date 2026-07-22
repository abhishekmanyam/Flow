import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { subscribeToAccessibleProjects, createProject } from "@/lib/firestore";
import { toast } from "@/components/system/toast";
import { Plus, FolderKanban, ArrowUpRight } from "lucide-react";
import { PROJECT_COLORS } from "@/lib/types";
import type { Project } from "@/lib/types";
import { Layout, LayoutHeader, LayoutContent } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Token } from "@astryxdesign/core/Token";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";

type ColorName = "purple" | "pink" | "orange" | "yellow" | "green" | "teal" | "blue" | "red";

// Map the arbitrary project hex palette to the nearest Astryx named color variant
// (no raw hex/style permitted — categorization colors flow through component variants).
const HEX_TO_COLOR: Record<string, ColorName> = {
  "#6366f1": "purple",
  "#8b5cf6": "purple",
  "#ec4899": "pink",
  "#f97316": "orange",
  "#eab308": "yellow",
  "#22c55e": "green",
  "#14b8a6": "teal",
  "#3b82f6": "blue",
  "#ef4444": "red",
  "#a855f7": "purple",
};
const COLOR_LABEL: Record<ColorName, string> = {
  purple: "Purple",
  pink: "Pink",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  teal: "Teal",
  blue: "Blue",
  red: "Red",
};
function colorName(hex: string): ColorName {
  return HEX_TO_COLOR[hex] ?? "blue";
}

export default function ProjectsPage() {
  const { workspace, user, role } = useAuthStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspace || !user || !role) return;
    return subscribeToAccessibleProjects(workspace.id, user.uid, role, (p) => {
      setProjects(p);
      setLoaded(true);
    });
  }, [workspace?.id, user?.uid, role]);

  if (!workspace || !user) return null;
  const canEdit = role === "admin" || role === "manager";
  const active = projects.filter((p) => p.status === "active");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const project = await createProject(workspace.id, {
        workspaceId: workspace.id,
        name: name.trim(),
        description: description.trim(),
        color,
        status: "active",
        createdBy: user.uid,
      });
      toast.success("Project created");
      setOpen(false);
      setName(""); setDescription("");
      navigate(`/${workspace.slug}/projects/${project.id}/board`);
    } catch {
      toast.error("Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <HStack justify="between" align="center" paddingInline={4} paddingBlock={3}>
            <VStack gap={0.5}>
              <Heading level={1}>Projects</Heading>
              <Text type="supporting">{active.length} active project{active.length !== 1 ? "s" : ""}</Text>
            </VStack>
            {canEdit && (
              <Button label="New project" variant="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)} />
            )}
          </HStack>
        </LayoutHeader>
      }
    >
      <LayoutContent padding={4}>
        {!loaded ? (
          <Grid columns={{ minWidth: 260, max: 3 }} gap={4}>
            <Skeleton height={120} />
            <Skeleton height={120} index={1} />
            <Skeleton height={120} index={2} />
          </Grid>
        ) : active.length === 0 ? (
          <EmptyState
            icon={<FolderKanban />}
            title="No projects yet"
            description="Create your first project to start organizing work"
            actions={canEdit ? <Button label="Create first project" icon={<Plus size={16} />} onClick={() => setOpen(true)} /> : undefined}
          />
        ) : (
          <Grid columns={{ minWidth: 260, max: 3 }} gap={4}>
            {active.map((project) => (
              <ClickableCard
                key={project.id}
                label={`Open ${project.name}`}
                variant={colorName(project.color)}
                onClick={() => navigate(`/${workspace.slug}/projects/${project.id}/board`)}
              >
                <VStack gap={2}>
                  <HStack gap={2} align="center" justify="between">
                    <Heading level={4} maxLines={1}>{project.name}</Heading>
                    <ArrowUpRight size={16} />
                  </HStack>
                  {project.description
                    ? <Text type="supporting" maxLines={2}>{project.description}</Text>
                    : <Text type="supporting" color="placeholder">No description</Text>}
                </VStack>
              </ClickableCard>
            ))}
          </Grid>
        )}
      </LayoutContent>

      <Dialog isOpen={open} onOpenChange={setOpen} purpose="form" width={440}>
        <DialogHeader title="Create project" onOpenChange={setOpen} />
        <VStack gap={4} padding={4}>
          <FormLayout>
            <TextInput label="Project name" value={name} onChange={setName} placeholder="e.g. Website Redesign" isRequired hasAutoFocus />
            <TextArea label="Description" value={description} onChange={setDescription} placeholder="What is this project about?" rows={3} isOptional />
            <Selector
              label="Color"
              value={color}
              onChange={setColor}
              options={PROJECT_COLORS.map((c) => ({ value: c, label: COLOR_LABEL[colorName(c)] }))}
              renderOption={(opt) => <Token color={colorName(opt.value as string)} label={COLOR_LABEL[colorName(opt.value as string)]} size="sm" />}
            />
          </FormLayout>
          <HStack gap={2} justify="end">
            <Button label="Cancel" variant="ghost" onClick={() => setOpen(false)} />
            <Button label="Create project" variant="primary" isDisabled={!name.trim()} isLoading={loading} clickAction={handleCreate} />
          </HStack>
        </VStack>
      </Dialog>
    </Layout>
  );
}
