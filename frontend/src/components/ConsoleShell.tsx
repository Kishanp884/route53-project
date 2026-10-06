"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout, { AppLayoutProps } from "@cloudscape-design/components/app-layout";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Flashbar from "@cloudscape-design/components/flashbar";
import HelpPanel from "@cloudscape-design/components/help-panel";
import Input from "@cloudscape-design/components/input";
import Spinner from "@cloudscape-design/components/spinner";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import Box from "@cloudscape-design/components/box";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";
import { useTheme } from "@/lib/theme";
import Navigation from "./Navigation";
import ShortcutsModal from "./ShortcutsModal";

export interface Crumb {
  text: string;
  href: string;
}

interface ShellCtx {
  openHelp: (content: React.ReactNode) => void;
}
const ShellContext = createContext<ShellCtx>({ openHelp: () => {} });
export const useShell = () => useContext(ShellContext);

/** Intercepts Cloudscape link/breadcrumb clicks and routes them client-side. */
export function useFollow() {
  const router = useRouter();
  return useCallback(
    (e: CustomEvent<{ href?: string; external?: boolean }>) => {
      const href = e.detail.href;
      if (!href || e.detail.external) return;
      e.preventDefault();
      router.push(href);
    },
    [router],
  );
}

function formatAccount(id: string) {
  return id.replace(/(\d{4})(\d{4})(\d{4})/, "$1-$2-$3");
}

const defaultHelp = (
  <HelpPanel header={<h2>Amazon Route 53</h2>}>
    <p>
      Route 53 is a highly available and scalable Domain Name System (DNS) web service. Use hosted zones to manage the
      DNS records for a domain.
    </p>
    <h3>Keyboard shortcuts</h3>
    <p>
      Press <span className="r53-kbd">?</span> anywhere to see the list of keyboard shortcuts.
    </p>
  </HelpPanel>
);

export default function ConsoleShell({
  children,
  activeHref,
  breadcrumbs,
  contentType = "default",
  splitPanel,
  splitPanelOpen,
  onSplitPanelToggle,
}: {
  children: React.ReactNode;
  activeHref: string;
  breadcrumbs: Crumb[];
  contentType?: AppLayoutProps.ContentType;
  splitPanel?: React.ReactNode;
  splitPanelOpen?: boolean;
  onSplitPanelToggle?: (open: boolean) => void;
}) {
  const { user, loading, logout } = useAuth();
  const { items } = useNotifications();
  const { mode, setMode, density, setDensity } = useTheme();
  const router = useRouter();
  const follow = useFollow();
  const [navOpen, setNavOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [help, setHelp] = useState<React.ReactNode>(defaultHelp);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [splitSize, setSplitSize] = useState(420);
  const pendingG = useRef(false);

  const openHelp = useCallback((content: React.ReactNode) => {
    setHelp(content);
    setToolsOpen(true);
  }, []);

  // ---------------------------------------------------------------- keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("#top-nav input")?.focus();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (pendingG.current) {
        pendingG.current = false;
        const dest: Record<string, string> = {
          d: "/route53/v2/dashboard",
          z: "/route53/v2/hostedzones",
          h: "/route53/v2/healthchecks",
          t: "/route53/v2/trafficpolicies",
          r: "/route53/v2/resolver/vpcs",
        };
        if (dest[e.key]) {
          e.preventDefault();
          router.push(dest[e.key]);
        }
        return;
      }
      switch (e.key) {
        case "?":
          e.preventDefault();
          setShortcutsOpen(true);
          break;
        case "/": {
          const el = document.querySelector<HTMLInputElement>("[data-shortcut-search] input");
          if (el) {
            e.preventDefault();
            el.focus();
          }
          break;
        }
        case "c": {
          const el = document.querySelector<HTMLElement>("[data-shortcut-create] button, button[data-shortcut-create]");
          if (el && !el.hasAttribute("disabled")) {
            e.preventDefault();
            el.click();
          }
          break;
        }
        case "r": {
          const el = document.querySelector<HTMLElement>("[data-shortcut-refresh] button");
          if (el) {
            e.preventDefault();
            el.click();
          }
          break;
        }
        case "g":
          pendingG.current = true;
          setTimeout(() => (pendingG.current = false), 1200);
          break;
        case "[":
          setNavOpen((o) => !o);
          break;
        case "d":
          setMode(mode === "dark" ? "light" : "dark");
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, mode, setMode]);

  if (loading || !user) {
    return (
      <Box textAlign="center" padding={{ top: "xxxl" }}>
        <Spinner size="large" />
      </Box>
    );
  }

  return (
    <ShellContext.Provider value={{ openHelp }}>
      <div id="top-nav">
        <TopNavigation
          identity={{
            href: "/route53/v2/dashboard",
            title: "Route 53 Console",
            logo: { src: "/logo.svg", alt: "Route 53 Clone" },
            onFollow: (e) => {
              e.preventDefault();
              router.push("/route53/v2/dashboard");
            },
          }}
          search={
            <Input
              type="search"
              value={search}
              ariaLabel="Search"
              placeholder="Search hosted zones   [Alt+S]"
              onChange={({ detail }) => setSearch(detail.value)}
              onKeyDown={({ detail }) => {
                if (detail.key === "Enter") {
                  router.push(`/route53/v2/hostedzones?search=${encodeURIComponent(search)}`);
                }
              }}
            />
          }
          utilities={[
            {
              type: "button",
              iconName: "notification",
              title: "Notifications",
              ariaLabel: "Notifications",
              badge: items.length > 0,
              disableUtilityCollapse: false,
            },
            {
              type: "button",
              iconName: "status-info",
              title: "Help",
              ariaLabel: "Help",
              onClick: () => openHelp(defaultHelp),
            },
            {
              type: "menu-dropdown",
              iconName: "settings",
              ariaLabel: "Settings",
              title: "Settings",
              items: [
                {
                  id: "visual",
                  text: "Visual mode",
                  items: [
                    { id: "light", text: "Light", iconName: mode === "light" ? "check" : undefined },
                    { id: "dark", text: "Dark", iconName: mode === "dark" ? "check" : undefined },
                  ],
                },
                {
                  id: "density",
                  text: "Density",
                  items: [
                    { id: "comfortable", text: "Comfortable", iconName: density === "comfortable" ? "check" : undefined },
                    { id: "compact", text: "Compact", iconName: density === "compact" ? "check" : undefined },
                  ],
                },
                { id: "shortcuts", text: "Keyboard shortcuts" },
              ],
              onItemClick: ({ detail }) => {
                if (detail.id === "light" || detail.id === "dark") setMode(detail.id);
                if (detail.id === "comfortable" || detail.id === "compact") setDensity(detail.id);
                if (detail.id === "shortcuts") setShortcutsOpen(true);
              },
            },
            {
              type: "button",
              text: "Global",
              ariaLabel: "Region: Global",
              title: "Route 53 is a global service",
            },
            {
              type: "menu-dropdown",
              text: `${user.username} @ ${formatAccount(user.account_id)}`,
              description: `Account ID: ${formatAccount(user.account_id)}`,
              iconName: "user-profile",
              items: [
                { id: "account", text: "Account", disabled: true },
                { id: "orgs", text: "Organization", disabled: true },
                { id: "billing", text: "Billing and Cost Management", disabled: true },
                { id: "creds", text: "Security credentials", disabled: true },
                { id: "signout", text: "Sign out" },
              ],
              onItemClick: ({ detail }) => {
                if (detail.id === "signout") logout();
              },
            },
          ]}
        />
      </div>
      <AppLayout
        headerSelector="#top-nav"
        navigation={<Navigation activeHref={activeHref} />}
        navigationOpen={navOpen}
        onNavigationChange={({ detail }) => setNavOpen(detail.open)}
        breadcrumbs={<BreadcrumbGroup items={breadcrumbs} ariaLabel="Breadcrumbs" onFollow={follow} />}
        notifications={<Flashbar items={items} stackItems={items.length > 2} />}
        tools={help}
        toolsOpen={toolsOpen}
        onToolsChange={({ detail }) => setToolsOpen(detail.open)}
        contentType={contentType}
        splitPanel={splitPanel}
        splitPanelOpen={splitPanelOpen}
        onSplitPanelToggle={({ detail }) => onSplitPanelToggle?.(detail.open)}
        splitPanelSize={splitSize}
        onSplitPanelResize={({ detail }) => setSplitSize(detail.size)}
        splitPanelPreferences={{ position: "side" }}
        content={children}
        ariaLabels={{
          navigation: "Navigation drawer",
          navigationClose: "Close navigation drawer",
          navigationToggle: "Open navigation drawer",
          notifications: "Notifications",
          tools: "Help panel",
          toolsClose: "Close help panel",
          toolsToggle: "Open help panel",
        }}
      />
      <ShortcutsModal visible={shortcutsOpen} onDismiss={() => setShortcutsOpen(false)} />
    </ShellContext.Provider>
  );
}
