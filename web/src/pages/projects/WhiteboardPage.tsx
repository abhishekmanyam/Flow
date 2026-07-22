import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { getDoc } from "firebase/firestore";
import { projectDoc } from "@/lib/firestore";
import ProjectHeader from "@/components/projects/ProjectHeader";
import { Layout, LayoutContent, LayoutHeader } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { ExternalLink, PenTool, Settings } from "lucide-react";
import type { Project } from "@/lib/types";

function toEmbedUrl(url: string): string {
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
  const navigate = useNavigate();
  const { workspace } = useAuthStore();
  const { loading: accessLoading, hasAccess, canEdit, isProjectAdmin } = useProjectAccess(projectId);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!workspace || !projectId || accessLoading || !hasAccess) return;
    getDoc(projectDoc(workspace.id, projectId)).then((snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
    });
  }, [workspace?.id, projectId, accessLoading, hasAccess]);

  if (accessLoading || !workspace || (!project && hasAccess)) {
    return (
      <Layout>
        <LayoutContent padding={4}>
          <VStack gap={3}>
            <Skeleton height={32} width={220} />
            <Skeleton height={420} />
          </VStack>
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

  return (
    <Layout
      header={<ProjectHeader project={project!} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} />}
      content={
        project!.miroBoardUrl ? (
          <Layout
            header={
              <LayoutHeader hasDivider>
                <HStack justify="between" align="center" paddingInline={4} paddingBlock={2}>
                  <Text type="supporting" color="secondary">Miro Board (view only)</Text>
                  <Button
                    label="Open in Miro to edit"
                    variant="secondary"
                    size="sm"
                    icon={<ExternalLink size={14} />}
                    onClick={() => window.open(project!.miroBoardUrl!, "_blank", "noopener,noreferrer")}
                  />
                </HStack>
              </LayoutHeader>
            }
            content={
              <LayoutContent padding={0} isScrollable={false}>
                <iframe
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  src={toEmbedUrl(project!.miroBoardUrl)}
                  title="Miro whiteboard"
                  allow="fullscreen; clipboard-read; clipboard-write"
                  allowFullScreen
                />
              </LayoutContent>
            }
          />
        ) : (
          <LayoutContent padding={4}>
            <EmptyState
              icon={<PenTool size={28} />}
              title="No whiteboard connected"
              description="Add a Miro board URL in project settings to embed it here."
              actions={
                (canEdit || isProjectAdmin) ? (
                  <Button
                    label="Go to Settings"
                    variant="secondary"
                    icon={<Settings size={16} />}
                    onClick={() => navigate(`/${slug}/projects/${projectId}/settings`)}
                  />
                ) : undefined
              }
            />
          </LayoutContent>
        )
      }
    />
  );
}
