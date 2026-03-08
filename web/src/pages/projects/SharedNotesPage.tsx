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
import { MotionPage } from "@/components/ui/motion-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Trash2, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
  };

  // Determine if user can delete the selected note
  const canDeleteSelected =
    canEdit &&
    selectedNote &&
    (selectedNote.createdBy === user?.uid || isProjectAdmin);

  if (accessLoading || !workspace || !user) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have access to this project.
          </p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <MotionPage className="flex flex-col h-full">
      <ProjectHeader
        project={project}
        workspaceSlug={slug!}
        canEdit={canEdit}
        isProjectAdmin={isProjectAdmin}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — note list */}
        <div className="w-64 border-r flex flex-col">
          <div className="p-3 border-b space-y-2">
            <Button
              size="sm"
              className="w-full"
              onClick={handleCreate}
              disabled={!canEdit}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Note
            </Button>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Globe className="h-3 w-3 shrink-0" />
              Notes are visible to all project members
            </p>
          </div>
          <ScrollArea className="flex-1">
            {notes.length === 0 && loaded && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No notes yet
              </div>
            )}
            {notes.map((note) => {
              const ownerProfile = profiles.get(note.createdBy);
              return (
                <button
                  key={note.id}
                  onClick={() => setSelectedId(note.id)}
                  className={`w-full text-left px-3 py-2.5 border-b transition-colors hover:bg-muted/50 ${
                    selectedId === note.id
                      ? "bg-muted"
                      : ""
                  }`}
                >
                  <p className="text-sm font-medium truncate">
                    {note.title || "Untitled"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {ownerProfile?.name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(tsToDate(note.updatedAt), {
                      addSuffix: true,
                    })}
                  </p>
                </button>
              );
            })}
          </ScrollArea>
        </div>

        {/* Main area — editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedNote ? (
            <>
              {/* Title + delete */}
              <div className="flex items-center gap-2 px-6 pt-4 pb-2">
                {canEdit ? (
                  <Input
                    value={draftTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Note title"
                    className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
                  />
                ) : (
                  <h2 className="text-lg font-semibold flex-1">
                    {selectedNote.title || "Untitled"}
                  </h2>
                )}
                {canDeleteSelected && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete note</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &ldquo;{selectedNote.title || "Untitled"}&rdquo;. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              {/* Editor */}
              <div className="flex-1 overflow-auto px-6 pb-4">
                <RichTextEditor
                  content={draftContent}
                  onChange={handleContentChange}
                  editable={canEdit}
                  placeholder="Start writing..."
                />
              </div>

              {/* Footer — metadata */}
              <div className="px-6 py-2 border-t text-xs text-muted-foreground flex items-center gap-4">
                <span>
                  Created by{" "}
                  {profiles.get(selectedNote.createdBy)?.name ?? "Unknown"}
                </span>
                {selectedNote.updatedAt && (
                  <span>
                    Updated{" "}
                    {profiles.get(selectedNote.updatedBy)?.name
                      ? `by ${profiles.get(selectedNote.updatedBy)!.name} `
                      : ""}
                    {formatDistanceToNow(tsToDate(selectedNote.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={FileText}
                title="No note selected"
                description={
                  canEdit
                    ? "Select a note from the sidebar or create a new one"
                    : "Select a note from the sidebar to view it"
                }
                className="py-16"
              />
            </div>
          )}
        </div>
      </div>
    </MotionPage>
  );
}
