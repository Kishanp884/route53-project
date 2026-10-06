"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import Textarea from "@cloudscape-design/components/textarea";
import Alert from "@cloudscape-design/components/alert";
import ConsoleShell from "@/components/ConsoleShell";
import ZoneTagEditor, { EditorTag, fromEditorTags, toEditorTags } from "@/components/ZoneTagEditor";
import { api, ApiError } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import type { HostedZone } from "@/lib/types";

const HREF = "/route53/v2/hostedzones";

export default function EditHostedZonePage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const router = useRouter();
  const { notify } = useNotifications();
  const [zone, setZone] = useState<HostedZone | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<readonly EditorTag[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getZone(zoneId)
      .then((z) => {
        setZone(z);
        setDescription(z.description);
        setTags(toEditorTags(z.tags));
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Failed to load hosted zone."));
  }, [zoneId]);

  const submit = async () => {
    if (!zone) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateZone(zone.id, { description, tags: fromEditorTags(tags) });
      notify({ type: "success", content: `Hosted zone ${zone.name} was successfully updated.` });
      router.push(`${HREF}/${zone.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to update hosted zone.");
      setBusy(false);
    }
  };

  return (
    <ConsoleShell
      activeHref={HREF}
      contentType="form"
      breadcrumbs={[
        { text: "Route 53", href: "/route53/v2/dashboard" },
        { text: "Hosted zones", href: HREF },
        { text: zone?.name ?? zoneId, href: `${HREF}/${zoneId}` },
        { text: "Edit hosted zone", href: `${HREF}/${zoneId}/edit` },
      ]}
    >
      <ContentLayout header={<Header variant="h1">Edit hosted zone</Header>}>
        {loadError ? (
          <Alert type="error" header="Hosted zone not found">
            {loadError}
          </Alert>
        ) : !zone ? (
          <Spinner size="large" />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Form
              errorText={error}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button formAction="none" variant="link" onClick={() => router.push(`${HREF}/${zone.id}`)}>
                    Cancel
                  </Button>
                  <Button variant="primary" loading={busy}>
                    Save changes
                  </Button>
                </SpaceBetween>
              }
            >
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Hosted zone configuration</Header>}>
                  <SpaceBetween size="l">
                    <FormField label="Domain name" description="You can't change the domain name of a hosted zone.">
                      <Input value={zone.name} disabled />
                    </FormField>
                    <FormField label="Type">
                      <Input value={zone.type === "public" ? "Public hosted zone" : "Private hosted zone"} disabled />
                    </FormField>
                    <FormField
                      label={
                        <span>
                          Description <i>- optional</i>
                        </span>
                      }
                      description="This value lets you distinguish hosted zones that have the same name."
                      constraintText={`The description can have up to 256 characters. ${description.length}/256`}
                    >
                      <Textarea
                        value={description}
                        rows={2}
                        onChange={({ detail }) => setDescription(detail.value.slice(0, 256))}
                      />
                    </FormField>
                  </SpaceBetween>
                </Container>
                <Container header={<Header variant="h2">Tags</Header>}>
                  <ZoneTagEditor tags={tags} onChange={setTags} />
                </Container>
              </SpaceBetween>
            </Form>
          </form>
        )}
      </ContentLayout>
    </ConsoleShell>
  );
}
