import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import {
  subscribeToNotes,
  createNote,
  updateNote,
  deleteNote,
  getMemberProfiles,
} from "@/lib/firestore";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProjectHeader from "@/components/projects/ProjectHeader";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { Layout, LayoutContent, LayoutHeader, LayoutFooter, LayoutPanel } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { List, ListItem } from "@astryxdesign/core/List";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Plus, FileText, Trash2, Globe } from "lucide-react";
import type { Project, ProjectNote, UserProfile } from "@/lib/types";

function tsToDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (typeof (ts as { toDate?: () => Date }).toDate === "function")
    return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

export default function SharedNotesPage() {
  const { slug, projectId } = useParams<{
    slug: string;
    projectId: string;
  }>();
  const { workspace, user } = useAuthStore();
  const {
    loading: accessLoading,
    hasAccess,
    canEdit,
    isProjectAdmin,
  } = useProjectAccess(projectId);

  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(
    new Map()
  );
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Draft state for auto-save
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTitleRef = useRef("");
  const lastSavedContentRef = useRef("");

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  // Load project
  useEffect(() => {
    if (!workspace || !projectId || accessLoading || !hasAccess) return;
    getDoc(
      doc(db, "workspaces", workspace.id, "projects", projectId)
    ).then((snap) => {
      if (snap.exists())
        setProject({ id: snap.id, ...snap.data() } as Project);
    });
  }, [workspace?.id, projectId, accessLoading, hasAccess]);

  // Subscribe to notes
  useEffect(() => {
    if (!workspace || !projectId) return;
    return subscribeToNotes(workspace.id, projectId, (list) => {
      setNotes(list);
      if (!loaded) setLoaded(true);

      // Collect unique user IDs for profiles
      const ids = new Set<string>();
      list.forEach((n) => {
        ids.add(n.createdBy);
        ids.add(n.updatedBy);
      });
      if (ids.size > 0) {
        getMemberProfiles([...ids]).then(setProfiles);
      }
    });
  }, [workspace?.id, projectId]);

  // When selecting a note, populate drafts
  useEffect(() => {
    if (!selectedNote) {
      setDraftTitle("");
      setDraftContent("");
      lastSavedTitleRef.current = "";
      lastSavedContentRef.current = "";
      return;
    }
    setDraftTitle(selectedNote.title);
    setDraftContent(selectedNote.content);
    lastSavedTitleRef.current = selectedNote.title;
    lastSavedContentRef.current = selectedNote.content;
  }, [selectedId]);

  // Auto-save helpers
  const saveTitle = useCallback(
    (title: string) => {
      if (!workspace || !projectId || !selectedId || !user) return;
      lastSavedTitleRef.current = title;
      updateNote(workspace.id, projectId, selectedId, { title }, user.uid).catch(
        () => {}
      );
    },
    [workspace?.id, projectId, selectedId, user?.uid]
  );

  const saveContent = useCallback(
    (content: string) => {
      if (!workspace || !projectId || !selectedId || !user) return;
      lastSavedContentRef.current = content;
      updateNote(
        workspace.id,
        projectId,
        selectedId,
        { content },
        user.uid
      ).catch(() => {});
    },
    [workspace?.id, projectId, selectedId, user?.uid]
  );

  const handleTitleChange = (value: string) => {
    setDraftTitle(value);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => saveTitle(value), 1000);
  };

  const handleContentChange = (html: string) => {
    setDraftContent(html);
    if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
    contentTimerRef.current = setTimeout(() => saveContent(html), 1000);
  };

  // Save pending on unmount
  useEffect(() => {
    return () => {
      if (titleTimerRef.current) {
        clearTimeout(titleTimerRef.current);
        if (
          draftTitle !== lastSavedTitleRef.current &&
          workspace &&
          projectId &&
          selectedId &&
          user
        ) {
          updateNote(
            workspace.id,
            projectId,
            selectedId,
            { title: draftTitle },
            user.uid
          ).catch(() => {});
        }
      }
      if (contentTimerRef.current) {
        clearTimeout(contentTimerRef.current);
        if (
          draftContent !== lastSavedContentRef.current &&
          workspace &&
          projectId &&
          selectedId &&
          user
        ) {
          updateNote(
            workspace.id,
            projectId,
            selectedId,
            { content: draftContent },
            user.uid
          ).catch(() => {});
        }
      }
    };
  }, [
    draftTitle,
    draftContent,
    workspace?.id,
    projectId,
    selectedId,
    user?.uid,
  ]);

  const handleCreate = async () => {
    if (!workspace || !projectId || !user) return;
    const note = await createNote(
      workspace.id,
      projectId,
      "Untitled",
      user.uid
    );
    setSelectedId(note.id);
  };

  const handleDelete = async () => {
    if (!workspace || !projectId || !selectedId) return;
    await deleteNote(workspace.id, projectId, selectedId);
    setSelectedId(null);
    setConfirmDelete(false);
  };

  // Determine if user can delete the selected note
  const canDeleteSelected =
    canEdit &&
    selectedNote &&
    (selectedNote.createdBy === user?.uid || isProjectAdmin);

  if (accessLoading || !workspace || !user) {
    return (
      <Layout>
        <LayoutContent padding={4}>
          <VStack gap={3}><Skeleton height={28} width={200} /><Skeleton height={360} /></VStack>
        </LayoutContent>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <LayoutContent padding={4}>
          <Banner status="error" title="Access denied" description="You don't have access to this project." />
        </LayoutContent>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <LayoutContent padding={4}>
          <VStack gap={3}><Skeleton height={28} width={200} /><Skeleton height={360} /></VStack>
        </LayoutContent>
      </Layout>
    );
  }

  return (
    <>
    <Layout
      header={<ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} />}
      content={
        <Layout
          start={
            <LayoutPanel width={264} hasDivider isScrollable padding={0}>
              <VStack gap={2} padding={3}>
                <Button label="New Note" variant="primary" size="sm" width="100%" icon={<Plus size={16} />} isDisabled={!canEdit} onClick={handleCreate} />
                <HStack gap={1} align="center">
                  <Globe size={12} />
                  <Text type="supporting" color="secondary">Notes are visible to all project members</Text>
                </HStack>
              </VStack>
              {notes.length === 0 && loaded ? (
                <VStack padding={4} align="center">
                  <Text type="supporting" color="secondary">No notes yet</Text>
                </VStack>
              ) : (
                <List hasDividers>
                  {notes.map((note) => {
                    const ownerProfile = profiles.get(note.createdBy);
                    return (
                      <ListItem
                        key={note.id}
                        isSelected={selectedId === note.id}
                        onClick={() => setSelectedId(note.id)}
                        label={note.title || "Untitled"}
                        description={
                          <VStack gap={0}>
                            <Text type="supporting" color="secondary">{ownerProfile?.name ?? "Unknown"}</Text>
                            <Timestamp value={tsToDate(note.updatedAt).toISOString()} format="relative" type="supporting" />
                          </VStack>
                        }
                      />
                    );
                  })}
                </List>
              )}
            </LayoutPanel>
          }
          content={
            selectedNote ? (
              <Layout
                header={
                  <LayoutHeader hasDivider>
                    <HStack justify="between" align="center" gap={2} paddingInline={5} paddingBlock={3}>
                      {canEdit ? (
                        <TextInput label="Note title" isLabelHidden value={draftTitle} onChange={handleTitleChange} placeholder="Note title" />
                      ) : (
                        <Heading level={2}>{selectedNote.title || "Untitled"}</Heading>
                      )}
                      {canDeleteSelected && (
                        <IconButton label="Delete note" variant="ghost" icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)} />
                      )}
                    </HStack>
                  </LayoutHeader>
                }
                content={
                  <LayoutContent padding={5}>
                    <RichTextEditor
                      content={draftContent}
                      onChange={handleContentChange}
                      editable={canEdit}
                      placeholder="Start writing..."
                    />
                  </LayoutContent>
                }
                footer={
                  <LayoutFooter hasDivider>
                    <HStack gap={4} align="center" paddingInline={5} paddingBlock={2}>
                      <Text type="supporting" color="secondary">
                        Created by {profiles.get(selectedNote.createdBy)?.name ?? "Unknown"}
                      </Text>
                      {selectedNote.updatedAt && (
                        <HStack gap={1} align="center">
                          <Text type="supporting" color="secondary">
                            Updated{profiles.get(selectedNote.updatedBy)?.name ? ` by ${profiles.get(selectedNote.updatedBy)!.name}` : ""}
                          </Text>
                          <Timestamp value={tsToDate(selectedNote.updatedAt).toISOString()} format="relative" type="supporting" />
                        </HStack>
                      )}
                    </HStack>
                  </LayoutFooter>
                }
              />
            ) : (
              <LayoutContent padding={4}>
                <EmptyState
                  icon={<FileText size={28} />}
                  title="No note selected"
                  description={canEdit
                    ? "Select a note from the sidebar or create a new one"
                    : "Select a note from the sidebar to view it"}
                />
              </LayoutContent>
            )
          }
        />
      }
    />
    <AlertDialog
      isOpen={confirmDelete}
      onOpenChange={setConfirmDelete}
      title="Delete note"
      description={`This will permanently delete "${selectedNote?.title || "Untitled"}". This action cannot be undone.`}
      actionLabel="Delete"
      onAction={handleDelete}
    />
    </>
  );
}
