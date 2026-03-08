import { useState, useRef } from "react";
import { updateProfile } from "firebase/auth";
import { useAuthStore } from "@/store/auth";
import { upsertUserProfile, updateWorkspace } from "@/lib/firestore";
import { uploadAvatar } from "@/lib/storage";
import { AvatarCropDialog } from "@/components/settings/AvatarCropDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MotionPage } from "@/components/ui/motion-page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, HardDrive, Camera, Shield } from "lucide-react";

const MAX_AVATAR_SIZE = 10 * 1024 * 1024; // 10MB

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(/\s/).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("");
}

function TimesheetIpSection({ wsId, currentIp }: { wsId: string; currentIp: string }) {
  const [ip, setIp] = useState(currentIp);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWorkspace(wsId, { allowedTimesheetIp: ip.trim() || null });
      toast.success(ip.trim() ? "Timesheet IP restriction updated" : "Timesheet IP restriction removed");
    } catch {
      toast.error("Failed to update IP restriction");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-base font-medium">Timesheet IP Restriction</h2>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
            <Shield className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-sm font-medium">Allowed IP Address</CardTitle>
            <CardDescription className="text-xs">
              Restrict timesheet access to a single IP address (e.g. office network)
            </CardDescription>
          </div>
          {currentIp ? (
            <Badge variant="secondary">Active</Badge>
          ) : (
            <Badge variant="outline">Off</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="allowed-ip">IP Address</Label>
            <Input
              id="allowed-ip"
              placeholder="e.g. 203.0.113.50"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to allow access from any IP. Only one IP is supported.
            </p>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving || ip === currentIp}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

export default function SettingsPage() {
  const { user, workspace, role } = useAuthStore();
  const [name, setName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.photoURL ?? null);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error("File must be an image");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("File must be under 10MB");
      return;
    }

    const url = URL.createObjectURL(file);
    setCropSrc(url);
  };

  const handleCropComplete = async (blob: Blob) => {
    if (!user) return;
    setCropSrc(null);
    setUploading(true);
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const url = await uploadAvatar(user.uid, file);
      await Promise.all([
        upsertUserProfile(user.uid, { avatarUrl: url }),
        updateProfile(user, { photoURL: url }),
      ]);
      setAvatarUrl(url);
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleCropDialogChange = (open: boolean) => {
    if (!open && cropSrc) {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await upsertUserProfile(user.uid, { name: name.trim() });
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!workspace) return null;

  return (
    <MotionPage className="p-6 max-w-xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="space-y-4">
        <h2 className="text-base font-medium">Your profile</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="relative group"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback className="text-lg">{getInitials(user?.displayName)}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <p className="text-sm text-muted-foreground">Click to upload avatar (max 10MB)</p>
          </div>
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save profile
          </Button>
        </form>
      </section>
      {role === "admin" && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="text-base font-medium">Workspace</h2>
            <div className="space-y-2">
              <Label>Workspace name</Label>
              <Input value={workspace.name} disabled />
            </div>
            <div className="space-y-2">
              <Label>URL slug</Label>
              <Input value={workspace.slug} disabled />
              <p className="text-xs text-muted-foreground">Slug cannot be changed after creation.</p>
            </div>
          </section>
        </>
      )}
      {role === "admin" && (
        <>
          <Separator />
          <TimesheetIpSection wsId={workspace.id} currentIp={workspace.allowedTimesheetIp ?? ""} />
        </>
      )}
      <Separator />
      <section className="space-y-4">
        <h2 className="text-base font-medium">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect third-party services to attach files and links to your tasks.
        </p>
        <div className="grid gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
                <HardDrive className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-sm font-medium">Google Drive</CardTitle>
                <CardDescription className="text-xs">Attach files from Google Drive to tasks</CardDescription>
              </div>
              {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                <Badge variant="secondary">Configured</Badge>
              ) : (
                <Badge variant="outline">Not configured</Badge>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {import.meta.env.VITE_GOOGLE_CLIENT_ID
                  ? "Google Drive integration is ready. You can attach Drive files from any task."
                  : "Add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_APP_ID to your .env.local file to enable."}
              </p>
            </CardContent>
          </Card>

        </div>
      </section>
      {cropSrc && (
        <AvatarCropDialog
          open={!!cropSrc}
          onOpenChange={handleCropDialogChange}
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
        />
      )}
    </MotionPage>
  );
}
