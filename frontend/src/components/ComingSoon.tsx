"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useRouter } from "next/navigation";
import ConsoleShell from "./ConsoleShell";

export default function ComingSoon({ title, href, description }: { title: string; href: string; description?: string }) {
  const router = useRouter();
  return (
    <ConsoleShell
      activeHref={href}
      breadcrumbs={[
        { text: "Route 53", href: "/route53/v2/dashboard" },
        { text: title, href },
      ]}
    >
      <ContentLayout header={<Header variant="h1" description={description}>{title}</Header>}>
        <Container>
          <Box textAlign="center" padding={{ vertical: "xxxl" }} color="inherit">
            <SpaceBetween size="m">
              <Box variant="h2">Coming soon</Box>
              <Box color="text-body-secondary">
                {title} is not available in this Route 53 clone yet. Hosted zones and DNS records are fully functional.
              </Box>
              <div>
                <Button variant="primary" onClick={() => router.push("/route53/v2/hostedzones")}>
                  Go to hosted zones
                </Button>
              </div>
            </SpaceBetween>
          </Box>
        </Container>
      </ContentLayout>
    </ConsoleShell>
  );
}
