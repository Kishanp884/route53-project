"use client";

import { useParams } from "next/navigation";
import ComingSoon from "@/components/ComingSoon";
import { NAV_ITEMS } from "@/components/Navigation";
import type { SideNavigationProps } from "@cloudscape-design/components/side-navigation";

function findTitle(href: string, items: readonly SideNavigationProps.Item[]): string | null {
  for (const it of items) {
    if ((it.type === "link") && it.href === href) return it.text;
    if ("items" in it && it.items) {
      const t = findTitle(href, it.items);
      if (t) return t;
    }
  }
  return null;
}

export default function PlaceholderPage() {
  const { slug } = useParams<{ slug: string[] }>();
  const href = `/route53/v2/${(slug ?? []).join("/")}`;
  const title = findTitle(href, NAV_ITEMS) ?? "Page";
  return <ComingSoon title={title} href={href} />;
}
