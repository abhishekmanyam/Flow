import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useAuthStore } from "@/store/auth";
import { subscribeToAccessibleProjects, createProject } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MotionPage } from "@/components/ui/motion-page";
import { StaggerContainer, StaggerItem } from "@/components/ui/stagger";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, FolderKanban, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PROJECT_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const { workspace, user, role } = useAuthStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspace || !user || !role) return;
    return subscribeToAccessibleProjects(workspace.id, user.uid, role, setProjects);
  }, [workspace?.id, user?.uid, role]);

  if (!workspace || !user) return null;
  const canEdit = role === "admin" || role === "manager";
  const active = projects.filter((p) => p.status === "active");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <MotionPage className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{active.length} active project{active.length !== 1 ? "s" : ""}</p>
        </div>
        {canEdit && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />New project
          </Button>
        )}
      </div>

      {active.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" description="Create your first project to start organizing work">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />Create first project
            </Button>
          )}
        </EmptyState>
      ) : (
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((project) => (
            <StaggerItem key={project.id}>
              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
              <Card className="group relative hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                    <h3 className="font-semibold truncate">{project.name}</h3>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                )}
                <button
                  onClick={() => navigate(`/${workspace.slug}/projects/${project.id}/board`)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Open board <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </CardContent>
            </Card>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create project</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Project name *</Label>
              <Input placeholder="e.g. Website Redesign" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What is this project about?" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
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
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={loading || !name.trim()} className="flex-1">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create project
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MotionPage>
  );
}
