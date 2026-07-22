import { useState } from "react";
import { updateProfile } from "firebase/auth";
import { HardDrive } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { upsertUserProfile, updateWorkspace } from "@/lib/firestore";
import { uploadAvatar } from "@/lib/storage";
import { AvatarCropDialog } from "@/components/settings/AvatarCropDialog";
import { toast } from "@/components/system/toast";
import { Layout, LayoutHeader, LayoutContent } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { FileInput } from "@astryxdesign/core/FileInput";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Token } from "@astryxdesign/core/Token";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Skeleton } from "@astryxdesign/core/Skeleton";

const MAX_AVATAR_SIZE = 10 * 1024 * 1024; // 10MB

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
    <Grid columns={{ minWidth: 320 }} gap={10}>
      <VStack gap={1}>
        <HStack gap={2} align="center">
          <Heading level={3}>Timesheet IP restriction</Heading>
          <Token label={currentIp ? "Active" : "Off"} color={currentIp ? "green" : "gray"} />
        </HStack>
        <Text type="supporting" color="secondary">
          Restrict timesheet clock-in to a single office network by IP address.
        </Text>
      </VStack>
      <VStack gap={4}>
        <TextInput
          label="Allowed IP address"
          placeholder="e.g. 203.0.113.50"
          value={ip}
          onChange={setIp}
          description="Leave empty to allow access from any IP. Only one IP is supported."
        />
        <HStack>
          <Button
            label="Save"
            variant="primary"
            onClick={handleSave}
            isLoading={saving}
            isDisabled={ip === currentIp}
          />
        </HStack>
      </VStack>
    </Grid>
  );
}

export default function SettingsPage() {
  const { user, workspace, role } = useAuthStore();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const [name, setName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.photoURL ?? null);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const handleFileSelect = (file: File | File[] | null) => {
    const f = Array.isArray(file) ? file[0] : file;
    if (!f) return;

    if (!f.type.startsWith("image/")) {
      toast.error("File must be an image");
      return;
    }
    if (f.size > MAX_AVATAR_SIZE) {
      toast.error("File must be under 10MB");
      return;
    }

    setCropSrc(URL.createObjectURL(f));
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

  const handleSaveProfile = async () => {
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

  const googleDriveConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const isAdmin = role === "admin";

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <HStack justify="between" align="center" paddingInline={4} paddingBlock={3}>
            <Heading level={1}>Settings</Heading>
          </HStack>
        </LayoutHeader>
      }
    >
      <LayoutContent padding={4}>
        {!workspace || !user ? (
          <VStack gap={8} maxWidth={860}>
            <Skeleton height={140} radius={2} />
            <Skeleton height={140} radius={2} />
          </VStack>
        ) : (
          <VStack gap={8} maxWidth={860}>
            {/* Profile */}
            <Grid columns={{ minWidth: 320 }} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>Your profile</Heading>
                <Text type="supporting" color="secondary">
                  Update your display name and profile photo.
                </Text>
              </VStack>
              <VStack gap={4}>
                <HStack gap={4} align="center">
                  <Avatar size="large" src={avatarUrl ?? undefined} name={user.displayName ?? user.email ?? undefined} />
                  <VStack gap={1} width="100%">
                    <FileInput
                      label="Change photo"
                      isLabelHidden
                      placeholder="Change photo"
                      accept="image/*"
                      value={null}
                      onChange={handleFileSelect}
                      isLoading={uploading}
                      isDisabled={uploading}
                    />
                    <Text type="supporting" color="secondary">
                      JPG or PNG. Max 10MB.
                    </Text>
                  </VStack>
                </HStack>
                <TextInput label="Display name" value={name} onChange={setName} placeholder="Your name" />
                <TextInput label="Email" value={user.email ?? ""} isDisabled />
                <HStack>
                  <Button label="Save profile" variant="primary" onClick={handleSaveProfile} isLoading={saving} />
                </HStack>
              </VStack>
            </Grid>

            <Divider />

            {/* Appearance */}
            <Grid columns={{ minWidth: 320 }} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>Appearance</Heading>
                <Text type="supporting" color="secondary">
                  Choose how the workspace looks on this device.
                </Text>
              </VStack>
              <VStack gap={4}>
                <SegmentedControl
                  label="Theme mode"
                  value={mode}
                  onChange={(v) => setMode(v as "system" | "light" | "dark")}
                >
                  <SegmentedControlItem value="system" label="System" />
                  <SegmentedControlItem value="light" label="Light" />
                  <SegmentedControlItem value="dark" label="Dark" />
                </SegmentedControl>
              </VStack>
            </Grid>

            {isAdmin && (
              <>
                <Divider />
                <Grid columns={{ minWidth: 320 }} gap={10}>
                  <VStack gap={1}>
                    <Heading level={3}>Workspace</Heading>
                    <Text type="supporting" color="secondary">
                      Workspace-level details visible to your team.
                    </Text>
                  </VStack>
                  <VStack gap={4}>
                    <TextInput label="Workspace name" value={workspace.name} isDisabled />
                    <TextInput
                      label="URL slug"
                      value={workspace.slug}
                      isDisabled
                      description="Slug cannot be changed after creation."
                    />
                  </VStack>
                </Grid>

                <Divider />
                <TimesheetIpSection wsId={workspace.id} currentIp={workspace.allowedTimesheetIp ?? ""} />
              </>
            )}

            <Divider />

            {/* Integrations */}
            <Grid columns={{ minWidth: 320 }} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>Integrations</Heading>
                <Text type="supporting" color="secondary">
                  Connect third-party services to attach files and links to your tasks.
                </Text>
              </VStack>
              <VStack gap={3}>
                <HStack justify="between" align="center">
                  <HStack gap={3} align="center">
                    <HardDrive size={20} />
                    <VStack gap={0}>
                      <Text weight="medium">Google Drive</Text>
                      <Text type="supporting" color="secondary">
                        Attach files from Google Drive to tasks
                      </Text>
                    </VStack>
                  </HStack>
                  <Token
                    label={googleDriveConfigured ? "Configured" : "Not configured"}
                    color={googleDriveConfigured ? "green" : "gray"}
                  />
                </HStack>
                <Text type="supporting" color="secondary">
                  {googleDriveConfigured
                    ? "Google Drive integration is ready. You can attach Drive files from any task."
                    : "Add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_APP_ID to your .env.local file to enable."}
                </Text>
              </VStack>
            </Grid>
          </VStack>
        )}
      </LayoutContent>

      {cropSrc && (
        <AvatarCropDialog
          open={!!cropSrc}
          onOpenChange={handleCropDialogChange}
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
        />
      )}
    </Layout>
  );
}
