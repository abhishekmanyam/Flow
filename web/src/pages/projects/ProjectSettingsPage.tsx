import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribeToLabels } from "@/lib/firestore";
import ProjectHeader from "@/components/projects/ProjectHeader";
import ManageLabelsDialog from "@/components/labels/ManageLabelsDialog";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Field } from "@astryxdesign/core/Field";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Button } from "@astryxdesign/core/Button";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { toast } from "@/components/system/toast";
import { Tags, PenTool } from "lucide-react";
import { IconButton } from "@astryxdesign/core/IconButton";
import { PROJECT_COLORS } from "@/lib/types";
import type { Project, Label as LabelType } from "@/lib/types";

function colorCircle(color: string, selected: boolean) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true">
      <circle cx={8} cy={8} r={selected ? 6 : 7} fill={color} stroke={selected ? "currentColor" : "none"} strokeWidth={selected ? 2 : 0} />
    </svg>
  );
}

export default function ProjectSettingsPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const { workspace } = useAuthStore();
  const { loading: accessLoading, canEdit, isProjectAdmin } = useProjectAccess(projectId);
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [miroBoardUrl, setMiroBoardUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [labels, setLabels] = useState<LabelType[]>([]);
  const [labelsOpen, setLabelsOpen] = useState(false);

  useEffect(() => {
    if (!workspace || !projectId) return;
    getDoc(doc(db, "workspaces", workspace.id, "projects", projectId)).then((snap) => {
      if (snap.exists()) {
        const p = { id: snap.id, ...snap.data() } as Project;
        setProject(p); setName(p.name); setDescription(p.description ?? ""); setColor(p.color); setMiroBoardUrl(p.miroBoardUrl ?? "");
      }
    });
    return subscribeToLabels(workspace.id, projectId, setLabels);
  }, [workspace?.id, projectId]);

  useEffect(() => {
    if (!accessLoading && !isProjectAdmin && workspace && projectId) {
      navigate(`/${slug}/projects/${projectId}/board`);
    }
  }, [accessLoading, isProjectAdmin]);

  if (accessLoading || !workspace || !project) {
    return (
      <Layout>
        <LayoutContent padding={4}>
          <VStack gap={3}><Skeleton height={28} width={200} /><Skeleton height={300} /></VStack>
        </LayoutContent>
      </Layout>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "workspaces", workspace.id, "projects", projectId!), { name, description, color, miroBoardUrl: miroBoardUrl.trim() || null });
      setProject((p) => p ? { ...p, name, description, color } : p);
      toast.success("Project updated");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const handleArchive = async () => {
    setArchiving(true);
    await updateDoc(doc(db, "workspaces", workspace.id, "projects", projectId!), { status: "archived" });
    toast.success("Project archived");
    navigate(`/${slug}/projects`);
  };

  return (
    <>
    <Layout
      header={<ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} />}
      content={
        <LayoutContent padding={4}>
          <VStack gap={5} maxWidth={640}>
            <Heading level={1}>Project Settings</Heading>

            <Card padding={5}>
              <FormLayout>
                <TextInput label="Name" isRequired value={name} onChange={setName} />
                <TextArea label="Description" value={description} onChange={setDescription} rows={3} isOptional />
                <Field label="Color" inputID="project-color">
                  <HStack gap={1} wrap="wrap">
                    {PROJECT_COLORS.map((c) => (
                      <IconButton
                        key={c}
                        label={`Color ${c}`}
                        variant={color === c ? "secondary" : "ghost"}
                        icon={colorCircle(c, color === c)}
                        onClick={() => setColor(c)}
                      />
                    ))}
                  </HStack>
                </Field>
                <HStack>
                  <Button label="Save changes" variant="primary" isLoading={saving} clickAction={handleSave} />
                </HStack>
              </FormLayout>
            </Card>

            <Card padding={5}>
              <VStack gap={2}>
                <Heading level={3}>Labels</Heading>
                <Text type="supporting" color="secondary">Manage labels for this project. Labels can be assigned to tasks for categorization.</Text>
                <HStack>
                  <Button label={`Manage labels (${labels.length})`} variant="secondary" size="sm" icon={<Tags size={14} />} onClick={() => setLabelsOpen(true)} />
                </HStack>
              </VStack>
            </Card>

            <Card padding={5}>
              <VStack gap={2}>
                <Heading level={3}>Miro Board</Heading>
                <Text type="supporting" color="secondary">Embed a Miro whiteboard in the project's Whiteboard tab.</Text>
                <TextInput
                  label="Miro board URL"
                  isLabelHidden
                  value={miroBoardUrl}
                  onChange={setMiroBoardUrl}
                  placeholder="https://miro.com/app/board/..."
                  startIcon={PenTool}
                />
              </VStack>
            </Card>

            <Card padding={5}>
              <VStack gap={3}>
                <Heading level={3} color="inherit">Danger zone</Heading>
                <Text type="supporting" color="secondary">Archiving hides this project from the workspace. You can restore it later.</Text>
                <HStack>
                  <Button label="Archive project" variant="destructive" isLoading={archiving} onClick={() => setConfirmArchive(true)} />
                </HStack>
              </VStack>
            </Card>
          </VStack>
        </LayoutContent>
      }
    />
    <ManageLabelsDialog
      open={labelsOpen}
      onClose={() => setLabelsOpen(false)}
      labels={labels}
      workspaceId={workspace.id}
      projectId={projectId!}
    />
    <AlertDialog
      isOpen={confirmArchive}
      onOpenChange={setConfirmArchive}
      title="Archive project"
      description="This project will be hidden from the workspace. You can restore it later from the projects list."
      actionLabel="Archive project"
      isActionLoading={archiving}
      onAction={async () => { await handleArchive(); setConfirmArchive(false); }}
    />
    </>
  );
}
