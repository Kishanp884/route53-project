"use client";

import Autosuggest from "@cloudscape-design/components/autosuggest";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select, { SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";
import RadioGroup from "@cloudscape-design/components/radio-group";
import { REGIONS } from "@/lib/regions";
import type { DnsRecord, RecordInput, RoutingPolicy } from "@/lib/types";
import InfoLink from "./InfoLink";

export const RECORD_TYPE_OPTIONS: SelectProps.Option[] = [
  { value: "A", label: "A", description: "Routes traffic to an IPv4 address and some AWS resources" },
  { value: "AAAA", label: "AAAA", description: "Routes traffic to an IPv6 address and some AWS resources" },
  { value: "CAA", label: "CAA", description: "Restricts CAs that can create SSL/TLS certifications for the domain" },
  { value: "CNAME", label: "CNAME", description: "Routes traffic to another domain name and to some AWS resources" },
  { value: "DS", label: "DS", description: "Delegation Signer, used to establish a chain of trust for DNSSEC" },
  { value: "HTTPS", label: "HTTPS", description: "Provides the information needed to connect to HTTPS endpoints" },
  { value: "MX", label: "MX", description: "Specifies mail servers" },
  { value: "NAPTR", label: "NAPTR", description: "Is used by Dynamic Delegation Discovery System (DDDS) applications" },
  { value: "NS", label: "NS", description: "Name servers for a hosted zone" },
  { value: "PTR", label: "PTR", description: "Maps an IP address to a domain name" },
  { value: "SPF", label: "SPF", description: "Not recommended" },
  { value: "SRV", label: "SRV", description: "Application-specific values that identify servers" },
  { value: "SSHFP", label: "SSHFP", description: "Publishes SSH public host key fingerprints" },
  { value: "SVCB", label: "SVCB", description: "Provides the information needed to connect to service endpoints" },
  { value: "TLSA", label: "TLSA", description: "Associates a TLS certificate with a domain name" },
  { value: "TXT", label: "TXT", description: "Used to verify email senders and for application-specific values" },
];

export const ROUTING_OPTIONS: SelectProps.Option[] = [
  { value: "simple", label: "Simple routing" },
  { value: "weighted", label: "Weighted" },
  { value: "geolocation", label: "Geolocation" },
  { value: "latency", label: "Latency" },
  { value: "failover", label: "Failover" },
  { value: "multivalue", label: "Multivalue answer" },
];

export const ROUTING_LABEL: Record<string, string> = {
  simple: "Simple",
  weighted: "Weighted",
  geolocation: "Geolocation",
  latency: "Latency",
  failover: "Failover",
  multivalue: "Multivalue answer",
  ip: "IP-based",
};

const ALIAS_TARGETS: SelectProps.Option[] = [
  { value: "Alias to API Gateway API", label: "Alias to API Gateway API" },
  { value: "Alias to App Runner application", label: "Alias to App Runner application" },
  { value: "Alias to Application and Classic Load Balancer", label: "Alias to Application and Classic Load Balancer" },
  { value: "Alias to CloudFront distribution", label: "Alias to CloudFront distribution" },
  { value: "Alias to Elastic Beanstalk environment", label: "Alias to Elastic Beanstalk environment" },
  { value: "Alias to Network Load Balancer", label: "Alias to Network Load Balancer" },
  { value: "Alias to S3 website endpoint", label: "Alias to S3 website endpoint" },
  { value: "Alias to VPC endpoint", label: "Alias to VPC endpoint" },
  { value: "Alias to another record in this hosted zone", label: "Alias to another record in this hosted zone" },
];

const GEO_OPTIONS: SelectProps.Option[] = [
  { value: "Default", label: "Default" },
  { value: "Africa", label: "Africa" },
  { value: "Antarctica", label: "Antarctica" },
  { value: "Asia", label: "Asia" },
  { value: "Europe", label: "Europe" },
  { value: "North America", label: "North America" },
  { value: "Oceania", label: "Oceania" },
  { value: "South America", label: "South America" },
  { value: "India", label: "India" },
  { value: "United States", label: "United States" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Germany", label: "Germany" },
  { value: "Japan", label: "Japan" },
  { value: "Brazil", label: "Brazil" },
  { value: "Australia", label: "Australia" },
];

export const VALUE_PLACEHOLDER: Record<string, string> = {
  A: "192.0.2.235",
  AAAA: "2001:0db8:85a3:0:0:8a2e:0370:7334",
  CAA: '0 issue "amazon.com"',
  CNAME: "www.example.com",
  MX: "10 mailserver.example.com",
  NS: "ns-1.awsdns-01.org",
  PTR: "hostname.example.com",
  SRV: "1 10 5269 xmpp-server.example.com",
  TXT: '"Sample text entries"',
  SPF: '"v=spf1 ip4:192.168.0.1/16 -all"',
};

export interface RecordDraft {
  key: string;
  name: string; // relative to the zone
  type: string;
  alias: boolean;
  value: string; // one value per line
  ttl: string;
  routing_policy: RoutingPolicy;
  set_identifier: string;
  weight: string;
  region: string;
  failover: "PRIMARY" | "SECONDARY";
  geolocation: string;
  health_check_id: string;
  alias_target_type: string;
  alias_target: string;
  evaluate_target_health: boolean;
}

let draftSeq = 0;
export function emptyDraft(): RecordDraft {
  return {
    key: `d${++draftSeq}`,
    name: "",
    type: "A",
    alias: false,
    value: "",
    ttl: "300",
    routing_policy: "simple",
    set_identifier: "",
    weight: "",
    region: "",
    failover: "PRIMARY",
    geolocation: "",
    health_check_id: "",
    alias_target_type: "Alias to another record in this hosted zone",
    alias_target: "",
    evaluate_target_health: true,
  };
}

export function relativeName(fqdn: string, zone: string) {
  if (fqdn === zone) return "";
  return fqdn.endsWith("." + zone) ? fqdn.slice(0, -(zone.length + 1)) : fqdn;
}

export function recordToDraft(r: DnsRecord, zone: string): RecordDraft {
  return {
    ...emptyDraft(),
    name: relativeName(r.name, zone),
    type: r.type,
    alias: r.alias,
    value: r.values.join("\n"),
    ttl: r.ttl == null ? "300" : String(r.ttl),
    routing_policy: r.routing_policy,
    set_identifier: r.set_identifier,
    weight: r.weight == null ? "" : String(r.weight),
    region: r.region ?? "",
    failover: r.failover ?? "PRIMARY",
    geolocation: r.geolocation ?? "",
    health_check_id: r.health_check_id ?? "",
    alias_target_type: r.alias_target_type ?? "Alias to another record in this hosted zone",
    alias_target: r.alias_target ?? "",
    evaluate_target_health: r.evaluate_target_health,
  };
}

export function draftToPayload(d: RecordDraft): Partial<RecordInput> {
  return {
    name: d.name.trim(),
    type: d.type,
    alias: d.alias,
    ttl: d.alias ? null : Number(d.ttl),
    values: d.alias ? [] : d.value.split("\n").map((v) => v.trim()).filter(Boolean),
    routing_policy: d.routing_policy,
    set_identifier: d.routing_policy === "simple" ? "" : d.set_identifier.trim(),
    weight: d.routing_policy === "weighted" && d.weight !== "" ? Number(d.weight) : null,
    region: d.routing_policy === "latency" ? d.region || null : null,
    failover: d.routing_policy === "failover" ? d.failover : null,
    geolocation: d.routing_policy === "geolocation" ? d.geolocation || null : null,
    health_check_id: d.health_check_id.trim() || null,
    alias_target: d.alias ? d.alias_target.trim() : null,
    alias_target_type: d.alias ? d.alias_target_type : null,
    evaluate_target_health: d.alias ? d.evaluate_target_health : false,
  };
}

/** Client-side validation mirroring the backend, so most mistakes are caught before submit. */
export function validateDraft(d: RecordDraft): Partial<Record<keyof RecordDraft, string>> {
  const e: Partial<Record<keyof RecordDraft, string>> = {};
  if (d.name && !/^[a-z0-9_*.-]+$/i.test(d.name.trim())) e.name = "Record name contains invalid characters.";
  if (d.alias) {
    if (!d.alias_target.trim()) e.alias_target = "Choose an endpoint.";
  } else {
    const vals = d.value.split("\n").map((v) => v.trim()).filter(Boolean);
    if (!vals.length) e.value = "Enter a value.";
    const bad = (msg: string) => (e.value = msg);
    for (const v of vals) {
      if (d.type === "A" && !/^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)$/.test(v)) bad(`'${v}' is not a valid IPv4 address.`);
      if (d.type === "AAAA" && !/^[0-9a-f:]+$/i.test(v)) bad(`'${v}' is not a valid IPv6 address.`);
      if (d.type === "MX" && !/^\d+\s+\S+$/.test(v)) bad("MX values must be in the format [priority] [mail server], e.g. 10 mail.example.com");
      if (d.type === "SRV" && !/^\d+\s+\d+\s+\d+\s+\S+$/.test(v)) bad("SRV values must be in the format [priority] [weight] [port] [host].");
      if (d.type === "CAA" && !/^\d+\s+(issue|issuewild|iodef|issuemail)\s+".*"$/i.test(v)) bad('CAA values must be in the format [flags] [tag] "[value]".');
    }
    if (d.type === "CNAME" && vals.length > 1) e.value = "A CNAME record can contain only one value.";
    const ttl = Number(d.ttl);
    if (d.ttl === "" || !Number.isInteger(ttl) || ttl < 0 || ttl > 2147483647) e.ttl = "TTL must be an integer between 0 and 2147483647.";
  }
  if (d.routing_policy !== "simple" && !d.set_identifier.trim()) e.set_identifier = "Enter a record ID.";
  if (d.routing_policy === "weighted") {
    const w = Number(d.weight);
    if (d.weight === "" || !Number.isInteger(w) || w < 0 || w > 255) e.weight = "Weight must be an integer between 0 and 255.";
  }
  if (d.routing_policy === "latency" && !d.region) e.region = "Choose a Region.";
  if (d.routing_policy === "geolocation" && !d.geolocation) e.geolocation = "Choose a location.";
  return e;
}

const opt = (opts: SelectProps.Option[], v: string) => opts.find((o) => o.value === v) ?? null;

export default function RecordFields({
  draft,
  onChange,
  zoneName,
  errors,
  locked = false,
  zoneRecordNames = [],
  compact = false,
}: {
  draft: RecordDraft;
  onChange: (d: RecordDraft) => void;
  zoneName: string;
  errors: Partial<Record<keyof RecordDraft, string>>;
  locked?: boolean; // default SOA/NS: name/type/routing locked
  zoneRecordNames?: string[];
  compact?: boolean;
}) {
  const set = <K extends keyof RecordDraft>(k: K, v: RecordDraft[K]) => onChange({ ...draft, [k]: v });
  const typeOptions = locked ? [{ value: draft.type, label: draft.type }] : RECORD_TYPE_OPTIONS;
  const cols = compact ? 1 : 2;

  return (
    <SpaceBetween size="l">
      <ColumnLayout columns={cols}>
        <FormField
          label="Record name"
          info={<InfoLink topic="records" />}
          description="Keep blank to create a record for the root domain."
          errorText={errors.name}
          constraintText="Valid characters: a-z, 0-9, ! &quot; # $ % & ' ( ) * + , - / : ; < = > ? @ [ \ ] ^ _ ` { | } . ~"
        >
          <div className="r53-suffix">
            <Input
              value={draft.name}
              disabled={locked}
              placeholder="subdomain"
              onChange={({ detail }) => set("name", detail.value)}
            />
            <span>.{zoneName}</span>
          </div>
        </FormField>
        <FormField label="Record type">
          <Select
            selectedOption={opt(typeOptions, draft.type) ?? { value: draft.type, label: draft.type }}
            options={typeOptions}
            disabled={locked}
            filteringType="auto"
            triggerVariant="option"
            onChange={({ detail }) => set("type", detail.selectedOption.value!)}
          />
        </FormField>
      </ColumnLayout>

      {!locked && (
        <Toggle checked={draft.alias} onChange={({ detail }) => set("alias", detail.checked)} description="Route traffic to an AWS resource or another record instead of an IP address or domain name.">
          Alias
        </Toggle>
      )}

      {draft.alias ? (
        <SpaceBetween size="m">
          <FormField label="Route traffic to" errorText={errors.alias_target}>
            <SpaceBetween size="xs">
              <Select
                selectedOption={opt(ALIAS_TARGETS, draft.alias_target_type)}
                options={ALIAS_TARGETS}
                onChange={({ detail }) => set("alias_target_type", detail.selectedOption.value!)}
              />
              <Autosuggest
                value={draft.alias_target}
                onChange={({ detail }) => set("alias_target", detail.value)}
                options={
                  draft.alias_target_type === "Alias to another record in this hosted zone"
                    ? zoneRecordNames.map((n) => ({ value: n }))
                    : []
                }
                enteredTextLabel={(v) => `Use: "${v}"`}
                placeholder={
                  draft.alias_target_type === "Alias to another record in this hosted zone"
                    ? "Choose record"
                    : "Enter endpoint, e.g. d111111abcdef8.cloudfront.net"
                }
                empty="No records"
              />
            </SpaceBetween>
          </FormField>
          <FormField label="Evaluate target health">
            <Toggle
              checked={draft.evaluate_target_health}
              onChange={({ detail }) => set("evaluate_target_health", detail.checked)}
            >
              {draft.evaluate_target_health ? "Yes" : "No"}
            </Toggle>
          </FormField>
        </SpaceBetween>
      ) : (
        <>
          <FormField
            label="Value"
            info={<InfoLink topic="recordValue" />}
            description="Enter multiple values on separate lines."
            errorText={errors.value}
          >
            <Textarea
              value={draft.value}
              rows={3}
              placeholder={VALUE_PLACEHOLDER[draft.type] ?? ""}
              onChange={({ detail }) => set("value", detail.value)}
            />
          </FormField>
          <ColumnLayout columns={cols}>
            <FormField
              label="TTL (seconds)"
              description="Recommended values: 60 to 172800 (two days)"
              errorText={errors.ttl}
            >
              <div className="r53-suffix">
                <Input type="number" inputMode="numeric" value={draft.ttl} onChange={({ detail }) => set("ttl", detail.value)} />
                <SpaceBetween direction="horizontal" size="xxs">
                  <Button formAction="none" onClick={() => set("ttl", "60")}>1m</Button>
                  <Button formAction="none" onClick={() => set("ttl", "3600")}>1h</Button>
                  <Button formAction="none" onClick={() => set("ttl", "86400")}>1d</Button>
                </SpaceBetween>
              </div>
            </FormField>
            <FormField label="Routing policy" info={<InfoLink topic="records" />}>
              <Select
                selectedOption={opt(ROUTING_OPTIONS, draft.routing_policy)}
                options={ROUTING_OPTIONS}
                disabled={locked}
                onChange={({ detail }) => set("routing_policy", detail.selectedOption.value as RoutingPolicy)}
              />
            </FormField>
          </ColumnLayout>
        </>
      )}

      {draft.alias && (
        <FormField label="Routing policy" info={<InfoLink topic="records" />}>
          <Select
            selectedOption={opt(ROUTING_OPTIONS, draft.routing_policy)}
            options={ROUTING_OPTIONS.filter((o) => o.value !== "multivalue")}
            onChange={({ detail }) => set("routing_policy", detail.selectedOption.value as RoutingPolicy)}
          />
        </FormField>
      )}

      {draft.routing_policy !== "simple" && (
        <ColumnLayout columns={cols}>
          {draft.routing_policy === "weighted" && (
            <FormField label="Weight" description="Number between 0 and 255." errorText={errors.weight}>
              <Input type="number" value={draft.weight} placeholder="0-255" onChange={({ detail }) => set("weight", detail.value)} />
            </FormField>
          )}
          {draft.routing_policy === "latency" && (
            <FormField label="Region" errorText={errors.region}>
              <Select
                selectedOption={opt(REGIONS, draft.region)}
                options={REGIONS}
                placeholder="Choose Region"
                filteringType="auto"
                onChange={({ detail }) => set("region", detail.selectedOption.value!)}
              />
            </FormField>
          )}
          {draft.routing_policy === "failover" && (
            <FormField label="Failover record type">
              <RadioGroup
                value={draft.failover}
                onChange={({ detail }) => set("failover", detail.value as "PRIMARY" | "SECONDARY")}
                items={[
                  { value: "PRIMARY", label: "Primary" },
                  { value: "SECONDARY", label: "Secondary" },
                ]}
              />
            </FormField>
          )}
          {draft.routing_policy === "geolocation" && (
            <FormField label="Location" errorText={errors.geolocation}>
              <Select
                selectedOption={opt(GEO_OPTIONS, draft.geolocation)}
                options={GEO_OPTIONS}
                placeholder="Choose location"
                filteringType="auto"
                onChange={({ detail }) => set("geolocation", detail.selectedOption.value!)}
              />
            </FormField>
          )}
          <FormField label={<span>Health check <i>- optional</i></span>}>
            <Input value={draft.health_check_id} placeholder="Health check ID" onChange={({ detail }) => set("health_check_id", detail.value)} />
          </FormField>
          <FormField
            label="Record ID"
            description="Enter a value that uniquely identifies this record among records with the same name and type."
            errorText={errors.set_identifier}
          >
            <Input value={draft.set_identifier} placeholder="Example: Seattle data center" onChange={({ detail }) => set("set_identifier", detail.value)} />
          </FormField>
        </ColumnLayout>
      )}
    </SpaceBetween>
  );
}
