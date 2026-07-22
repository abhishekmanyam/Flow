import type { ReactNode } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { Center } from "@astryxdesign/core/Center";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Divider } from "@astryxdesign/core/Divider";
import { Text } from "@astryxdesign/core/Text";

interface PublicLayoutProps {
  children: ReactNode;
  workspaceName?: string;
}

const CONTENT_WIDTH = 896;

export default function PublicLayout({
  children,
  workspaceName,
}: PublicLayoutProps) {
  return (
    <AppShell
      height="auto"
      variant="section"
      contentPadding={0}
      topNav={
        <TopNav
          label="Public events navigation"
          heading={
            <TopNavHeading
              headingHref="/"
              heading={workspaceName ?? "Events"}
            />
          }
        />
      }
    >
      <VStack gap={0}>
        <Center axis="horizontal">
          <VStack
            width="100%"
            maxWidth={CONTENT_WIDTH}
            padding={6}
            paddingBlock={8}
            gap={6}
          >
            {children}
          </VStack>
        </Center>

        <Divider />

        <Center axis="horizontal">
          <HStack
            width="100%"
            maxWidth={CONTENT_WIDTH}
            paddingInline={6}
            paddingBlock={5}
            justify="between"
            align="center"
          >
            <Text type="supporting">Powered by FlowTask</Text>
            {workspaceName && <Text type="supporting">{workspaceName}</Text>}
          </HStack>
        </Center>
      </VStack>
    </AppShell>
  );
}
