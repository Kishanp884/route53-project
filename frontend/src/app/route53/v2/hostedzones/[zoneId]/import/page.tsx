"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import FileUpload from "@cloudscape-design/components/file-upload";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import ConsoleShell from "@/components/ConsoleShell";
import InfoLink from "@/components/InfoLink";
import { api, ApiError } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import type { HostedZone } from "@/lib/types";

const HREF = "/route53/v2/hostedzones";

export default function ImportZoneFilePage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const router = useRouter();
  const { notify } = useNotifications();
  const [zone, setZone] = useState<HostedZone | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getZone(zoneId).then(setZone).catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load zone."));
  }, [zoneId]);

  const sample = zone
    ? `$ORIGIN ${zone.name}.\n$TTL 3600\n@        IN  A      192.0.2.1\nwww      IN  CNAME  ${zone.name}.\n@        IN  MX     10 mail.${zone.name}.\nmail     IN  A      192.0.2.2\n@        IN  TXT    "v=spf1 mx -all"`
    : "";

  const submit = async () => {
    if (!text.trim()) {
      setError("Enter or upload a zone file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.importZone(zoneId, text);
      notify({
        type: "success",
        content: `Imported ${res.created} record${res.created === 1 ? "" : "s"} into ${zone?.name}.${res.skipped ? ` ${res.skipped} skipped (SOA, apex NS or already existing).` : ""}`,
      });
      router.push(`${HREF}/${zoneId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Import failed.");
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
        { text: "Import zone file", href: `${HREF}/${zoneId}/import` },
      ]}
    >
      <ContentLayout
        header={
          <Header variant="h1" info={<InfoLink topic="importZone" />} description="Import records into this hosted zone from a BIND-formatted zone file.">
            Import zone file
          </Header>
        }
      >
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
                <Button formAction="none" variant="link" onClick={() => router.push(`${HREF}/${zoneId}`)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={busy}>
                  Import
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween size="l">
              <Alert type="info">
                SOA records and NS records for the zone apex are ignored. Records with the same name and type as an existing record are skipped.
              </Alert>
              <Container header={<Header variant="h2">Zone file</Header>}>
                <SpaceBetween size="l">
                  <FormField label="Upload a zone file" description="Optional. The file contents are loaded into the text box below.">
                    <FileUpload
                      value={files}
                      accept=".zone,.txt,.db,text/plain"
                      onChange={async ({ detail }) => {
                        setFiles(detail.value);
                        if (detail.value[0]) setText(await detail.value[0].text());
                      }}
                      i18nStrings={{
                        uploadButtonText: () => "Choose file",
                        dropzoneText: () => "Drop zone file to upload",
                        removeFileAriaLabel: (i) => `Remove file ${i + 1}`,
                        limitShowFewer: "Show fewer files",
                        limitShowMore: "Show more files",
                        errorIconAriaLabel: "Error",
                      }}
                      showFileSize
                    />
                  </FormField>
                  <FormField
                    label="Zone file"
                    description="Paste the contents of a zone file in BIND format."
                    secondaryControl={sample && <Button formAction="none" onClick={() => setText(sample)}>Insert sample</Button>}
                  >
                    <div className="r53-zone-file">
                      <Textarea value={text} rows={16} placeholder={sample} onChange={({ detail }) => setText(detail.value)} />
                    </div>
                  </FormField>
                </SpaceBetween>
              </Container>
            </SpaceBetween>
          </Form>
        </form>
      </ContentLayout>
    </ConsoleShell>
  );
}
