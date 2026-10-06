"use client";

import SideNavigation, { SideNavigationProps } from "@cloudscape-design/components/side-navigation";
import { useFollow } from "./ConsoleShell";

const B = "/route53/v2";

export const NAV_ITEMS: SideNavigationProps.Item[] = [
  { type: "link", text: "Dashboard", href: `${B}/dashboard` },
  { type: "link", text: "Hosted zones", href: `${B}/hostedzones` },
  { type: "link", text: "Health checks", href: `${B}/healthchecks` },
  { type: "link", text: "Profiles", href: `${B}/profiles`, info: undefined },
  {
    type: "section",
    text: "IP-based routing",
    items: [{ type: "link", text: "CIDR collections", href: `${B}/cidrcollections` }],
  },
  {
    type: "section",
    text: "Traffic flow",
    items: [
      { type: "link", text: "Traffic policies", href: `${B}/trafficpolicies` },
      { type: "link", text: "Policy records", href: `${B}/policyrecords` },
    ],
  },
  {
    type: "section",
    text: "Domains",
    items: [
      { type: "link", text: "Registered domains", href: `${B}/domains` },
      { type: "link", text: "Requests", href: `${B}/domains/requests` },
    ],
  },
  {
    type: "section",
    text: "Resolver",
    items: [
      { type: "link", text: "VPCs", href: `${B}/resolver/vpcs` },
      { type: "link", text: "Inbound endpoints", href: `${B}/resolver/inbound-endpoints` },
      { type: "link", text: "Outbound endpoints", href: `${B}/resolver/outbound-endpoints` },
      { type: "link", text: "Rules", href: `${B}/resolver/rules` },
      { type: "link", text: "Query logging", href: `${B}/resolver/query-logging` },
    ],
  },
  {
    type: "section",
    text: "DNS Firewall",
    items: [
      { type: "link", text: "Rule groups", href: `${B}/firewall/rule-groups` },
      { type: "link", text: "Domain lists", href: `${B}/firewall/domain-lists` },
    ],
  },
  {
    type: "section",
    text: "Application Recovery Controller",
    defaultExpanded: false,
    items: [
      { type: "link", text: "Readiness check", href: `${B}/arc/readiness` },
      { type: "link", text: "Routing control", href: `${B}/arc/routing-control` },
    ],
  },
  { type: "divider" },
  { type: "link", text: "Documentation", href: "https://docs.aws.amazon.com/route53/", external: true },
];

export default function Navigation({ activeHref }: { activeHref: string }) {
  const follow = useFollow();
  return (
    <SideNavigation
      header={{ text: "Route 53", href: `${B}/dashboard` }}
      activeHref={activeHref}
      items={NAV_ITEMS}
      onFollow={follow}
    />
  );
}
