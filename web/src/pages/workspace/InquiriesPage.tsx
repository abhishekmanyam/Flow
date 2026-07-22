import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Layout, LayoutHeader, LayoutContent } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import CampRegistrationsView from "@/components/inquiries/CampRegistrationsView";
import EnrollmentsView from "@/components/inquiries/EnrollmentsView";

export default function InquiriesPage() {
  const { role } = useAuthStore();
  const canAccess = role === "admin" || role === "manager";
  const [tab, setTab] = useState("camp");

  if (!canAccess) {
    return (
      <Layout>
        <LayoutContent padding={4}>
          <EmptyState
            icon={<Icon icon={ClipboardList} size="lg" />}
            title="Restricted"
            description="Only admins and managers can view inquiries."
          />
        </LayoutContent>
      </Layout>
    );
  }

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack paddingInline={4} paddingBlock={3} gap={0.5}>
            <Heading level={1}>Inquiries</Heading>
            <Text type="supporting">Submissions from the AIR Kids website.</Text>
          </VStack>
        </LayoutHeader>
      }
    >
      <LayoutContent padding={0}>
        <VStack gap={0}>
          <HStack paddingInline={4} paddingBlock={2}>
            <TabList value={tab} onChange={setTab} hasDivider>
              <Tab value="camp" label="Summer Camp" />
              <Tab value="enrollment" label="Enrollment" />
            </TabList>
          </HStack>
          {tab === "camp" ? <CampRegistrationsView /> : <EnrollmentsView />}
        </VStack>
      </LayoutContent>
    </Layout>
  );
}
