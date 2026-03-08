import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { getDoc } from "firebase/firestore";
import { projectDoc } from "@/lib/firestore";
import ProjectHeader from "@/components/projects/ProjectHeader";
import { MotionPage } from "@/components/ui/motion-page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, PenTool, Settings } from "lucide-react";
import type { Project } from "@/lib/types";

function toEmbedUrl(url: string): string {
  // Convert https://miro.com/app/board/ID=/ to embed URL
  let embedUrl = url.trim();
  if (embedUrl.includes("/app/board/")) {
    embedUrl = embedUrl.replace("/app/board/", "/app/live-embed/");
  }
  if (!embedUrl.includes("?")) {
    embedUrl += "?autoplay=yep";
  }
  return embedUrl;
}

export default function WhiteboardPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const { workspace } = useAuthStore();
  const { loading: accessLoading, hasAccess, canEdit, isProjectAdmin } = useProjectAccess(projectId);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!workspace || !projectId || accessLoading || !hasAccess) return;
    getDoc(projectDoc(workspace.id, projectId)).then((snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
    });
  }, [workspace?.id, projectId, accessLoading, hasAccess]);

  if (accessLoading || !workspace || !project) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">You don&apos;t have access to this project.</p>
        </div>
      </div>
    );
  }

  return (
    <MotionPage className="flex flex-col h-full">
      <ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} />

      {project.miroBoardUrl ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <p className="text-sm text-muted-foreground">Miro Board (view only)</p>
            <Button variant="outline" size="sm" asChild>
              <a href={project.miroBoardUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open in Miro to edit
              </a>
            </Button>
          </div>
          <div className="flex-1">
            <iframe
              src={toEmbedUrl(project.miroBoardUrl)}
              className="h-full w-full border-0"
              allow="fullscreen; clipboard-read; clipboard-write"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
              <PenTool className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="font-medium">No whiteboard connected</h3>
              <p className="text-sm text-muted-foreground">Add a Miro board URL in project settings to embed it here.</p>
            </div>
            {(canEdit || isProjectAdmin) && (
              <Button variant="outline" asChild>
                <Link to={`/${slug}/projects/${projectId}/settings`}>
                  <Settings className="mr-2 h-4 w-4" />Go to Settings
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </MotionPage>
  );
}
