"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import ConsoleShell, { useFollow } from "@/components/ConsoleShell";
import { api } from "@/lib/api";

const HREF = "/route53/v2/dashboard";

function Counter({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  const follow = useFollow();
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <Box fontSize="display-l" fontWeight="light">
        {href ? (
          <Link href={href} variant="awsui-value-large" onFollow={follow}>
            {value}
          </Link>
        ) : (
          value
        )}
      </Box>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [zones, setZones] = useState<number | string>("-");
  const [pub, setPub] = useState<number | string>("-");

  useEffect(() => {
    api.listZones({ page_size: 1 }).then((r) => setZones(r.total)).catch(() => {});
    api.listZones({ page_size: 1, type: "public" }).then((r) => setPub(r.total)).catch(() => {});
  }, []);

  return (
    <ConsoleShell activeHref={HREF} breadcrumbs={[{ text: "Route 53", href: HREF }, { text: "Dashboard", href: HREF }]}>
      <ContentLayout header={<Header variant="h1">Route 53 Dashboard</Header>}>
        <SpaceBetween size="l">
          <Container header={<Header variant="h2">DNS management</Header>}>
            <ColumnLayout columns={4} variant="text-grid">
              <Counter label="Hosted zones" value={zones} href="/route53/v2/hostedzones" />
              <Counter label="Public hosted zones" value={pub} href="/route53/v2/hostedzones" />
              <Counter
                label="Private hosted zones"
                value={typeof zones === "number" && typeof pub === "number" ? zones - pub : "-"}
                href="/route53/v2/hostedzones"
              />
              <div>
                <Box variant="awsui-key-label">Get started</Box>
                <Box padding={{ top: "xs" }}>
                  <Button variant="primary" onClick={() => router.push("/route53/v2/hostedzones/create")}>
                    Create hosted zone
                  </Button>
                </Box>
              </div>
            </ColumnLayout>
          </Container>
          <ColumnLayout columns={3}>
            <Container header={<Header variant="h2">Traffic management</Header>}>
              <Box color="text-body-secondary">Traffic policies — coming soon.</Box>
            </Container>
            <Container header={<Header variant="h2">Availability monitoring</Header>}>
              <Box color="text-body-secondary">Health checks — coming soon.</Box>
            </Container>
            <Container header={<Header variant="h2">Domain registration</Header>}>
              <Box color="text-body-secondary">Registered domains — coming soon.</Box>
            </Container>
          </ColumnLayout>
        </SpaceBetween>
      </ContentLayout>
    </ConsoleShell>
  );
}
