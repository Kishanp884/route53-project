"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import ConsoleShell, { useFollow } from "@/components/ConsoleShell";
import DeleteZoneModal from "@/components/DeleteZoneModal";
import InfoLink from "@/components/InfoLink";
import { TableEmpty } from "@/components/TableEmpty";
import { useDebounce } from "@/components/useDebounce";
import { api, ApiError, downloadText } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import type { HostedZone } from "@/lib/types";

const HREF = "/route53/v2/hostedzones";

const TYPE_OPTIONS = [
  { value: "", label: "All hosted zone types" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
];

type Prefs = {
  pageSize: number;
  visibleContent: string[];
  wrapLines: boolean;
  stripedRows: boolean;
};

const DEFAULT_PREFS: Prefs = {
  pageSize: 10,
  visibleContent: ["name", "type", "created_by", "record_count", "description", "id"],
  wrapLines: false,
  stripedRows: false,
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem("r53.zonePrefs");
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function HostedZonesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const follow = useFollow();
  const { notify } = useNotifications();

  const [filter, setFilter] = useState(params.get("search") ?? "");
  const debounced = useDebounce(filter);
  const [typeOpt, setTypeOpt] = useState(TYPE_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [sorting, setSorting] = useState<{ col: string; desc: boolean }>({ col: "name", desc: false });
  const [items, setItems] = useState<HostedZone[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HostedZone[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setPrefs(loadPrefs()), []);
  useEffect(() => {
    const s = params.get("search");
    if (s !== null) setFilter(s);
  }, [params]);
  useEffect(() => setPage(1), [debounced, typeOpt, prefs.pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listZones({
        search: debounced,
        type: typeOpt.value,
        page,
        page_size: prefs.pageSize,
        sort_by: sorting.col,
        sort_order: sorting.desc ? "desc" : "asc",
      });
      setItems(res.items);
      setTotal(res.total);
      setSelected((sel) => sel.filter((s) => res.items.some((i) => i.id === s.id)).map((s) => res.items.find((i) => i.id === s.id)!));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load hosted zones.");
    } finally {
      setLoading(false);
    }
  }, [debounced, typeOpt, page, prefs.pageSize, sorting]);

  useEffect(() => {
    load();
  }, [load]);

  const savePrefs = (p: Prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem("r53.zonePrefs", JSON.stringify(p));
    } catch {
      /* ignore */
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.bulkDeleteZones(selected.map((z) => z.id));
      const names = (ids: string[]) => selected.filter((z) => ids.includes(z.id)).map((z) => z.name);
      if (res.deleted.length) {
        notify({
          type: "success",
          content:
            res.deleted.length === 1
              ? `Hosted zone ${names(res.deleted)[0]} was successfully deleted.`
              : `${res.deleted.length} hosted zones were successfully deleted.`,
        });
      }
      res.failed.forEach((f) =>
        notify({
          type: "error",
          header: `Failed to delete hosted zone ${names([f.id])[0] ?? f.id}`,
          content: f.message,
        }),
      );
      setSelected([]);
      setDeleteOpen(false);
      load();
    } catch (e) {
      notify({ type: "error", content: e instanceof ApiError ? e.message : "Delete failed." });
    } finally {
      setDeleting(false);
    }
  };

  const exportSelected = async (format: "json" | "bind") => {
    for (const z of selected) {
      try {
        const text = await api.exportZone(z.id, format);
        downloadText(`${z.name}.${format === "json" ? "json" : "zone"}`, text, format === "json" ? "application/json" : "text/plain");
      } catch (e) {
        notify({ type: "error", content: e instanceof ApiError ? e.message : "Export failed." });
      }
    }
  };

  const columns: TableProps.ColumnDefinition<HostedZone>[] = [
    {
      id: "name",
      header: "Hosted zone name",
      sortingField: "name",
      isRowHeader: true,
      width: 260,
      cell: (z) => (
        <Link href={`${HREF}/${z.id}`} onFollow={follow}>
          {z.name}
        </Link>
      ),
    },
    { id: "type", header: "Type", sortingField: "type", cell: (z) => (z.type === "public" ? "Public" : "Private") },
    { id: "created_by", header: "Created by", cell: (z) => z.created_by },
    { id: "record_count", header: "Record count", sortingField: "record_count", cell: (z) => z.record_count },
    { id: "description", header: "Description", sortingField: "description", cell: (z) => z.description || "-" },
    { id: "id", header: "Hosted zone ID", sortingField: "id", width: 260, cell: (z) => z.id },
    {
      id: "created_at",
      header: "Created",
      sortingField: "created_at",
      cell: (z) => new Date(z.created_at).toLocaleString(),
    },
  ];

  const one = selected.length === 1 ? selected[0] : null;

  return (
    <>
      <Table<HostedZone>
        variant="full-page"
        stickyHeader
        resizableColumns
        enableKeyboardNavigation
        loading={loading}
        loadingText="Loading hosted zones"
        items={items}
        trackBy="id"
        selectionType="multi"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        ariaLabels={{
          selectionGroupLabel: "Hosted zones selection",
          allItemsSelectionLabel: () => "Select all hosted zones",
          itemSelectionLabel: (_s, z) => z.name,
        }}
        columnDefinitions={columns}
        columnDisplay={columns.map((c) => ({ id: c.id!, visible: prefs.visibleContent.includes(c.id!) }))}
        wrapLines={prefs.wrapLines}
        stripedRows={prefs.stripedRows}
        sortingColumn={{ sortingField: sorting.col }}
        sortingDescending={sorting.desc}
        onSortingChange={({ detail }) =>
          setSorting({ col: detail.sortingColumn.sortingField ?? "name", desc: !!detail.isDescending })
        }
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={selected.length ? `(${selected.length}/${total})` : `(${total})`}
            info={<InfoLink topic="hostedZones" />}
            description="Hosted zones contain records that specify how you want to route traffic for a domain and its subdomains."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <span data-shortcut-refresh>
                  <Button iconName="refresh" ariaLabel="Refresh" onClick={load} loading={loading && items.length > 0} />
                </span>
                <Button disabled={!one} onClick={() => one && router.push(`${HREF}/${one.id}`)}>
                  View details
                </Button>
                <Button disabled={!one} onClick={() => one && router.push(`${HREF}/${one.id}/edit`)}>
                  Edit
                </Button>
                <ButtonDropdown
                  disabled={!selected.length}
                  items={[
                    { id: "json", text: "Export as JSON" },
                    { id: "bind", text: "Export as BIND zone file" },
                  ]}
                  onItemClick={({ detail }) => exportSelected(detail.id as "json" | "bind")}
                >
                  Export
                </ButtonDropdown>
                <Button disabled={!selected.length} onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
                <span data-shortcut-create>
                  <Button variant="primary" onClick={() => router.push(`${HREF}/create`)}>
                    Create hosted zone
                  </Button>
                </span>
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <div data-shortcut-search style={{ minWidth: 320 }}>
              <TextFilter
                filteringText={filter}
                filteringPlaceholder="Filter hosted zones by property or value"
                filteringAriaLabel="Filter hosted zones"
                countText={debounced ? `${total} ${total === 1 ? "match" : "matches"}` : undefined}
                onChange={({ detail }) => setFilter(detail.filteringText)}
              />
            </div>
            <Select
              selectedOption={typeOpt}
              options={TYPE_OPTIONS}
              ariaLabel="Filter by type"
              onChange={({ detail }) => setTypeOpt(detail.selectedOption as (typeof TYPE_OPTIONS)[number])}
            />
          </SpaceBetween>
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={Math.max(1, Math.ceil(total / prefs.pageSize))}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
            ariaLabels={{ nextPageLabel: "Next page", previousPageLabel: "Previous page", pageLabel: (n) => `Page ${n}` }}
          />
        }
        preferences={
          <CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={{
              pageSize: prefs.pageSize,
              wrapLines: prefs.wrapLines,
              stripedRows: prefs.stripedRows,
              contentDisplay: columns.map((c) => ({ id: c.id!, visible: prefs.visibleContent.includes(c.id!) })),
            }}
            onConfirm={({ detail }) =>
              savePrefs({
                pageSize: detail.pageSize ?? 10,
                wrapLines: !!detail.wrapLines,
                stripedRows: !!detail.stripedRows,
                visibleContent: (detail.contentDisplay ?? []).filter((c) => c.visible).map((c) => c.id),
              })
            }
            pageSizePreference={{
              title: "Page size",
              options: [
                { value: 10, label: "10 hosted zones" },
                { value: 20, label: "20 hosted zones" },
                { value: 50, label: "50 hosted zones" },
                { value: 100, label: "100 hosted zones" },
              ],
            }}
            wrapLinesPreference={{ label: "Wrap lines", description: "Select to see all the text and wrap the lines" }}
            stripedRowsPreference={{ label: "Striped rows", description: "Select to add alternating shaded rows" }}
            contentDisplayPreference={{
              title: "Column preferences",
              options: columns.map((c) => ({ id: c.id!, label: String(c.header), alwaysVisible: c.id === "name" })),
            }}
          />
        }
        empty={
          error ? (
            <TableEmpty title="Error loading hosted zones" subtitle={error} action={<Button onClick={load}>Retry</Button>} />
          ) : debounced || typeOpt.value ? (
            <TableEmpty
              title="No matches"
              subtitle="We can't find a match."
              action={
                <Button
                  onClick={() => {
                    setFilter("");
                    setTypeOpt(TYPE_OPTIONS[0]);
                  }}
                >
                  Clear filter
                </Button>
              }
            />
          ) : (
            <TableEmpty
              title="No hosted zones"
              subtitle="You don't have any hosted zones."
              action={<Button onClick={() => router.push(`${HREF}/create`)}>Create hosted zone</Button>}
            />
          )
        }
      />
      <DeleteZoneModal
        zones={selected}
        visible={deleteOpen}
        busy={deleting}
        onDismiss={() => setDeleteOpen(false)}
        onConfirm={doDelete}
      />
    </>
  );
}

export default function HostedZonesPage() {
  return (
    <ConsoleShell
      activeHref={HREF}
      contentType="table"
      breadcrumbs={[
        { text: "Route 53", href: "/route53/v2/dashboard" },
        { text: "Hosted zones", href: HREF },
      ]}
    >
      <Suspense fallback={<Box padding="l">Loading…</Box>}>
        <HostedZonesContent />
      </Suspense>
    </ConsoleShell>
  );
}
