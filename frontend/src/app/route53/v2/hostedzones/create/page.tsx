"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Tiles from "@cloudscape-design/components/tiles";
import ConsoleShell from "@/components/ConsoleShell";
import InfoLink from "@/components/InfoLink";
import ZoneTagEditor, { EditorTag, fromEditorTags } from "@/components/ZoneTagEditor";
import { api, ApiError } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import { REGIONS } from "@/lib/regions";

const HREF = "/route53/v2/hostedzones";
const DOMAIN_RE = /^(?!-)[a-z0-9-_]{1,63}(?<!-)(\.(?!-)[a-z0-9-_]{1,63}(?<!-))*\.?$/i;

export default function CreateHostedZonePage() {
  const router = useRouter();
  const { notify } = useNotifications();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [region, setRegion] = useState<{ value: string; label: string } | null>(null);
  const [vpcId, setVpcId] = useState("");
  const [tags, setTags] = useState<readonly EditorTag[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = !name.trim()
    ? "Enter a domain name."
    : !DOMAIN_RE.test(name.trim())
      ? "Enter a valid domain name, such as example.com."
      : null;
  const vpcError = type === "private" && (!region || !vpcId.trim()) ? "Choose a Region and enter a VPC ID." : null;

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    if (nameError || vpcError) return;
    setBusy(true);
    try {
      const zone = await api.createZone({
        name: name.trim(),
        type,
        description,
        vpc_region: type === "private" ? region?.value : null,
        vpc_id: type === "private" ? vpcId.trim() : null,
        tags: fromEditorTags(tags),
      });
      notify({ type: "success", content: `Hosted zone ${zone.name} was successfully created.` });
      router.push(`${HREF}/${zone.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create hosted zone.");
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
        { text: "Create hosted zone", href: `${HREF}/create` },
      ]}
    >
      <ContentLayout
        header={
          <Header
            variant="h1"
            info={<InfoLink topic="createZone" />}
            description="A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains."
          >
            Create hosted zone
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
                <Button formAction="none" variant="link" onClick={() => router.push(HREF)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={busy}>
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween size="l">
              <Container header={<Header variant="h2">Hosted zone configuration</Header>}>
                <SpaceBetween size="l">
                  <FormField
                    label="Domain name"
                    description="This is the name of the domain that you want to route traffic for."
                    constraintText="Valid characters: a-z, 0-9, ! &quot; # $ % & ' ( ) * + , - / : ; < = > ? @ [ \ ] ^ _ ` { | } . ~"
                    errorText={submitted ? nameError : null}
                  >
                    <Input
                      value={name}
                      placeholder="example.com"
                      autoFocus
                      onChange={({ detail }) => setName(detail.value)}
                    />
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
                      placeholder="The hosted zone is used for..."
                      rows={2}
                      onChange={({ detail }) => setDescription(detail.value.slice(0, 256))}
                    />
                  </FormField>
                  <FormField label="Type" description="The type indicates whether you want to route traffic on the internet or in an Amazon VPC.">
                    <Tiles
                      value={type}
                      onChange={({ detail }) => setType(detail.value as "public" | "private")}
                      columns={2}
                      items={[
                        {
                          value: "public",
                          label: "Public hosted zone",
                          description: "A public hosted zone determines how traffic is routed on the internet.",
                        },
                        {
                          value: "private",
                          label: "Private hosted zone",
                          description: "A private hosted zone determines how traffic is routed within an Amazon VPC.",
                        },
                      ]}
                    />
                  </FormField>
                </SpaceBetween>
              </Container>

              {type === "private" && (
                <Container
                  header={
                    <Header
                      variant="h2"
                      description="To use this hosted zone to resolve DNS queries for one or more VPCs, choose the VPCs. To associate a VPC with a hosted zone when the VPC was created using a different AWS account, you must use a programmatic method."
                    >
                      VPCs to associate with the hosted zone
                    </Header>
                  }
                >
                  <SpaceBetween size="l" direction="horizontal">
                    <FormField label="Region" errorText={submitted && !region ? "Choose a Region." : null}>
                      <div style={{ minWidth: 300 }}>
                        <Select
                          selectedOption={region}
                          options={REGIONS}
                          placeholder="Choose Region"
                          filteringType="auto"
                          onChange={({ detail }) => setRegion(detail.selectedOption as { value: string; label: string })}
                        />
                      </div>
                    </FormField>
                    <FormField label="VPC ID" errorText={submitted && !vpcId.trim() ? "Enter a VPC ID." : null}>
                      <div style={{ minWidth: 300 }}>
                        <Input value={vpcId} placeholder="vpc-0123456789abcdef0" onChange={({ detail }) => setVpcId(detail.value)} />
                      </div>
                    </FormField>
                  </SpaceBetween>
                </Container>
              )}

              <Container
                header={
                  <Header
                    variant="h2"
                    description="Apply tags to hosted zones to help organize and identify them."
                  >
                    Tags
                  </Header>
                }
              >
                <ZoneTagEditor tags={tags} onChange={setTags} />
              </Container>
            </SpaceBetween>
          </Form>
        </form>
      </ContentLayout>
    </ConsoleShell>
  );
}
