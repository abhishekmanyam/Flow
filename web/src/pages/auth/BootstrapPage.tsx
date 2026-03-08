import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { createWorkspace, upsertUserProfile, getUserWorkspace } from "@/lib/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PasswordRequirements, { isPasswordValid } from "@/components/auth/PasswordRequirements";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function BootstrapPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [wsName, setWsName] = useState("CoreDefender AI");
  const [loading, setLoading] = useState(false);

  const slug = wsName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create Firebase Auth account
      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      // 2. Create workspace + admin member doc
      const workspace = await createWorkspace(wsName.trim(), slug, user.uid);

      // 3. Create user profile with workspace link
      await upsertUserProfile(user.uid, {
        id: user.uid,
        name,
        email,
        avatarUrl: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        workspaceIds: [workspace.id],
      });

      // 4. Load workspace into store
      const result = await getUserWorkspace(user.uid);
      if (result) {
        useAuthStore.getState().setWorkspace(result.workspace, result.role);
      }

      toast.success("Admin account created!");
      navigate("/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Bootstrap failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center mb-6">
            <img src="/flowtask.png" alt="FlowTask" className="h-12" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Bootstrap Admin</h1>
          <p className="text-sm text-muted-foreground">Create the first admin account and workspace</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Workspace name</Label>
            <Input value={wsName} onChange={(e) => setWsName(e.target.value)} required />
            {slug && <p className="text-xs text-muted-foreground">Slug: {slug}</p>}
          </div>
          <div className="space-y-2">
            <Label>Your name</Label>
            <Input placeholder="Abhishek" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="admin@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <PasswordRequirements password={password} />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !isPasswordValid(password)}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create admin account
          </Button>
        </form>
      </div>
    </div>
  );
}
