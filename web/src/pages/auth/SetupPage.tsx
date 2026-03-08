import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { createWorkspace, upsertUserProfile } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export default function SetupPage() {
  const navigate = useNavigate();
  const { user, setWorkspace } = useAuthStore();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const slug = slugify(name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setLoading(true);
    try {
      const workspace = await createWorkspace(name.trim(), slug, user.uid);
      await upsertUserProfile(user.uid, { workspaceIds: [workspace.id] });
      setWorkspace(workspace, "admin");
      navigate(`/${workspace.slug}/dashboard`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center mb-6">
            <img src="/flowtask.png" alt="FlowTask" className="h-12" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="text-sm text-muted-foreground">Set up your team&apos;s home base</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input
              id="ws-name"
              placeholder="Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            {slug && (
              <p className="text-xs text-muted-foreground">
                URL: flowtask.app/<span className="font-medium">{slug}</span>
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create workspace
          </Button>
        </form>
      </div>
    </div>
  );
}
