"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Form from "@cloudscape-design/components/form";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import ConsoleShell from "@/components/ConsoleShell";
import InfoLink from "@/components/InfoLink";
import RecordFields, { draftToPayload, emptyDraft, RecordDraft, validateDraft } from "@/components/RecordFields";
import { api, ApiError } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import type { HostedZone } from "@/lib/types";

const HREF = "/route53/v2/hostedzones";
type Errors = Partial<Record<keyof RecordDraft, string>>;

export default function CreateRecordPage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const router = useRouter();
  const { notify } = useNotifications();
  const [zone, setZone] = useState<HostedZone | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<RecordDraft[]>(() => [emptyDraft()]);
  const [errors, setErrors] = useState<Record<string, Errors>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    api.getZone(zoneId).then(setZone).catch((e) => setLoadError(e instanceof ApiError ? e.message : "Failed to load hosted zone."));
    api.listRecords(zoneId, { page_size: 300 }).then((r) => setNames(Array.from(new Set(r.items.map((x) => x.name))))).catch(() => {});
  }, [zoneId]);

  const update = (i: number, d: RecordDraft) => setDrafts((xs) => xs.map((x, j) => (j === i ? d : x)));

  const submit = async () => {
    const errs: Record<string, Errors> = {};
    drafts.forEach((d) => {
      const e = validateDraft(d);
      if (Object.keys(e).length) errs[d.key] = e;
    });
    setErrors(errs);
    setServerError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const created = await api.createRecords(zoneId, drafts.map(draftToPayload));
      notify({
        type: "success",
        content:
          created.length === 1
            ? `Record for ${created[0].name} was successfully created.`
            : `${created.length} records were successfully created.`,
      });
      router.push(`${HREF}/${zoneId}`);
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : "Failed to create records.");
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
        { text: "Create record", href: `${HREF}/${zoneId}/records/create` },
      ]}
    >
      <ContentLayout header={<Header variant="h1" info={<InfoLink topic="records" />}>Create record</Header>}>
        {loadError ? (
          <Alert type="error">{loadError}</Alert>
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
              errorText={serverError}
              errorIconAriaLabel="Error"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button formAction="none" variant="link" onClick={() => router.push(`${HREF}/${zoneId}`)}>
                    Cancel
                  </Button>
                  <Button variant="primary" loading={busy}>
                    Create records
                  </Button>
                </SpaceBetween>
              }
            >
              <Container
                header={
                  <Header
                    variant="h2"
                    description="Quick create lets you create one or more records in the same hosted zone."
                  >
                    Quick create record
                  </Header>
                }
              >
                <SpaceBetween size="l">
                  {drafts.map((d, i) => (
                    <Container
                      key={d.key}
                      header={
                        <Header
                          variant="h3"
                          actions={
                            drafts.length > 1 && (
                              <Button formAction="none" onClick={() => setDrafts((xs) => xs.filter((x) => x.key !== d.key))}>
                                Delete
                              </Button>
                            )
                          }
                        >
                          Record {i + 1}
                        </Header>
                      }
                    >
                      <RecordFields
                        draft={d}
                        onChange={(nd) => update(i, nd)}
                        zoneName={zone.name}
                        errors={errors[d.key] ?? {}}
                        zoneRecordNames={names}
                      />
                    </Container>
                  ))}
                  <Button formAction="none" iconName="add-plus" onClick={() => setDrafts((xs) => [...xs, emptyDraft()])}>
                    Add another record
                  </Button>
                </SpaceBetween>
              </Container>
            </Form>
          </form>
        )}
      </ContentLayout>
    </ConsoleShell>
  );
}
