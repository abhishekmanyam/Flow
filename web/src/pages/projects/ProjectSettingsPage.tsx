import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribeToLabels } from "@/lib/firestore";
import ProjectHeader from "@/components/projects/ProjectHeader";
import { MotionPage } from "@/components/ui/motion-page";
import ManageLabelsDialog from "@/components/labels/ManageLabelsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Trash2, Tags, PenTool } from "lucide-react";
import { PROJECT_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Project, Label as LabelType } from "@/lib/types";

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

  if (accessLoading || !workspace || !project) return <div className="p-6"><Skeleton className="h-8 w-48" /></div>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <MotionPage className="flex flex-col h-full">
      <ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} />
      <div className="flex-1 overflow-auto p-6 max-w-xl space-y-6">
        <h2 className="text-lg font-semibold">Project Settings</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn("h-7 w-7 rounded-full border-2 transition-all",
                    color === c ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground")}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes</Button>
        </form>
        <Separator />
        <div className="space-y-3">
          <h3 className="font-medium text-sm">Labels</h3>
          <p className="text-sm text-muted-foreground">Manage labels for this project. Labels can be assigned to tasks for categorization.</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLabelsOpen(true)}>
              <Tags className="mr-1.5 h-3.5 w-3.5" />Manage labels ({labels.length})
            </Button>
          </div>
        </div>
        <ManageLabelsDialog
          open={labelsOpen}
          onClose={() => setLabelsOpen(false)}
          labels={labels}
          workspaceId={workspace.id}
          projectId={projectId!}
        />
        <Separator />
        <div className="space-y-3">
          <h3 className="font-medium text-sm">Miro Board</h3>
          <p className="text-sm text-muted-foreground">Embed a Miro whiteboard in the project&apos;s Whiteboard tab.</p>
          <div className="flex items-center gap-2">
            <PenTool className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input value={miroBoardUrl} onChange={(e) => setMiroBoardUrl(e.target.value)} placeholder="https://miro.com/app/board/..." />
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-destructive">Danger zone</h3>
          <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={handleArchive} disabled={archiving}>
            {archiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Trash2 className="mr-2 h-4 w-4" />Archive project
          </Button>
        </div>
      </div>
    </MotionPage>
  );
}
