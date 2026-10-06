"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Container from "@cloudscape-design/components/container";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import Modal from "@cloudscape-design/components/modal";
import Multiselect, { MultiselectProps } from "@cloudscape-design/components/multiselect";
import Pagination from "@cloudscape-design/components/pagination";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import SplitPanel from "@cloudscape-design/components/split-panel";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table, { TableProps } from "@cloudscape-design/components/table";
import Tabs from "@cloudscape-design/components/tabs";
import TextFilter from "@cloudscape-design/components/text-filter";
import ConsoleShell from "@/components/ConsoleShell";
import DeleteZoneModal from "@/components/DeleteZoneModal";
import InfoLink from "@/components/InfoLink";
import RecordFields, {
  draftToPayload,
  RecordDraft,
  recordToDraft,
  ROUTING_LABEL,
  ROUTING_OPTIONS,
  RECORD_TYPE_OPTIONS,
  validateDraft,
} from "@/components/RecordFields";
import { TableEmpty } from "@/components/TableEmpty";
import { useDebounce } from "@/components/useDebounce";
import { api, ApiError, downloadText } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";
import type { DnsRecord, HostedZone } from "@/lib/types";

const HREF = "/route53/v2/hostedzones";

const ALIAS_OPTIONS = [
  { value: "", label: "All alias values" },
  { value: "true", label: "Alias: Yes" },
  { value: "false", label: "Alias: No" },
];

const ALL_RECORD_TYPES: MultiselectProps.Option[] = [{ value: "SOA", label: "SOA" }, ...RECORD_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))].sort((a, b) =>
  a.label!.localeCompare(b.label!),
);

function differentiator(r: DnsRecord): string {
  switch (r.routing_policy) {
    case "weighted":
      return r.weight != null ? String(r.weight) : "-";
    case "latency":
      return r.region ?? "-";
    case "failover":
      return r.failover === "PRIMARY" ? "Primary" : r.failover === "SECONDARY" ? "Secondary" : "-";
    case "geolocation":
      return r.geolocation ?? "-";
    default:
      return "-";
  }
}

function valueText(r: DnsRecord) {
  return r.alias ? r.alias_target ?? "" : r.values.join("\n");
}

type Prefs = { pageSize: number; visible: string[]; wrapLines: boolean };
const DEFAULT_PREFS: Prefs = {
  pageSize: 50,
  visible: ["name", "type", "routing_policy", "differentiator", "alias", "value", "ttl", "health_check_id", "evaluate_target_health", "set_identifier"],
  wrapLines: false,
};

export default function HostedZoneDetailsPage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const router = useRouter();
  const { notify } = useNotifications();

  const [zone, setZone] = useState<HostedZone | null>(null);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("records");

  // records table state
  const [filter, setFilter] = useState("");
  const debounced = useDebounce(filter);
  const [types, setTypes] = useState<readonly MultiselectProps.Option[]>([]);
  const [routing, setRouting] = useState<readonly MultiselectProps.Option[]>([]);
  const [aliasOpt, setAliasOpt] = useState(ALIAS_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [sorting, setSorting] = useState({ col: "name", desc: false });
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recError, setRecError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DnsRecord[]>([]);

  // modals / split panel
  const [deleteRecordsOpen, setDeleteRecordsOpen] = useState(false);
  const [deletingRecords, setDeletingRecords] = useState(false);
  const [deleteZoneOpen, setDeleteZoneOpen] = useState(false);
  const [deletingZone, setDeletingZone] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [editing, setEditing] = useState<RecordDraft | null>(null);
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof RecordDraft, string>>>({});
  const [editServerError, setEditServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("r53.recordPrefs");
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const loadZone = useCallback(() => {
    api
      .getZone(zoneId)
      .then(setZone)
      .catch((e) => setZoneError(e instanceof ApiError ? e.message : "Failed to load hosted zone."));
  }, [zoneId]);

  useEffect(loadZone, [loadZone]);
  useEffect(() => setPage(1), [debounced, types, routing, aliasOpt, prefs.pageSize]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setRecError(null);
    try {
      const res = await api.listRecords(zoneId, {
        search: debounced,
        type: types.map((t) => t.value).join(","),
        routing_policy: routing.map((t) => t.value).join(","),
        alias: aliasOpt.value,
        page,
        page_size: prefs.pageSize,
        sort_by: sorting.col,
        sort_order: sorting.desc ? "desc" : "asc",
      });
      setRecords(res.items);
      setTotal(res.total);
      setSelected((sel) => sel.map((s) => res.items.find((i) => i.id === s.id)).filter(Boolean) as DnsRecord[]);
    } catch (e) {
      setRecError(e instanceof ApiError ? e.message : "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }, [zoneId, debounced, types, routing, aliasOpt, page, prefs.pageSize, sorting]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const refreshAll = () => {
    loadZone();
    loadRecords();
  };

  // close edit mode when selection changes
  const selectedOne = selected.length === 1 ? selected[0] : null;
  useEffect(() => {
    setEditing(null);
    setEditErrors({});
    setEditServerError(null);
  }, [selectedOne?.id]);

  const recordNames = useMemo(() => Array.from(new Set(records.map((r) => r.name))), [records]);

  // ------------------------------------------------------------------ actions
  const deleteRecords = async () => {
    setDeletingRecords(true);
    try {
      const res = await api.bulkDeleteRecords(zoneId, selected.map((r) => r.id));
      if (res.deleted.length)
        notify({
          type: "success",
          content: `${res.deleted.length} ${res.deleted.length === 1 ? "record was" : "records were"} successfully deleted.`,
        });
      res.failed.forEach((f) => {
        const r = selected.find((x) => x.id === f.id);
        notify({ type: "error", header: `Failed to delete record ${r?.name ?? ""} ${r?.type ?? ""}`, content: f.message });
      });
      setSelected([]);
      setDeleteRecordsOpen(false);
      refreshAll();
    } catch (e) {
      notify({ type: "error", content: e instanceof ApiError ? e.message : "Delete failed." });
    } finally {
      setDeletingRecords(false);
    }
  };

  const deleteZone = async () => {
    if (!zone) return;
    setDeletingZone(true);
    try {
      await api.deleteZone(zone.id);
      notify({ type: "success", content: `Hosted zone ${zone.name} was successfully deleted.` });
      router.push(HREF);
    } catch (e) {
      notify({
        type: "error",
        header: `Failed to delete hosted zone ${zone.name}`,
        content: e instanceof ApiError ? e.message : "Delete failed.",
      });
      setDeleteZoneOpen(false);
      setDeletingZone(false);
    }
  };

  const saveRecord = async () => {
    if (!editing || !selectedOne || !zone) return;
    const errs = validateDraft(editing);
    setEditErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setEditServerError(null);
    try {
      const updated = await api.updateRecord(zoneId, selectedOne.id, draftToPayload(editing));
      notify({ type: "success", content: `Record ${updated.name} was successfully updated.` });
      setEditing(null);
      setSelected([updated]);
      loadRecords();
    } catch (e) {
      setEditServerError(e instanceof ApiError ? e.message : "Failed to update record.");
    } finally {
      setSaving(false);
    }
  };

  const exportZone = async (format: "json" | "bind") => {
    if (!zone) return;
    try {
      const text = await api.exportZone(zone.id, format);
      downloadText(`${zone.name}.${format === "json" ? "json" : "zone"}`, text, format === "json" ? "application/json" : "text/plain");
      notify({ type: "success", content: `Exported ${zone.name} as ${format === "json" ? "JSON" : "a BIND zone file"}.` });
    } catch (e) {
      notify({ type: "error", content: e instanceof ApiError ? e.message : "Export failed." });
    }
  };

  const savePrefs = (p: Prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem("r53.recordPrefs", JSON.stringify(p));
    } catch {
      /* ignore */
    }
  };

  // ------------------------------------------------------------------ table
  const columns: TableProps.ColumnDefinition<DnsRecord>[] = [
    { id: "name", header: "Record name", sortingField: "name", isRowHeader: true, width: 240, minWidth: 160, cell: (r) => r.name },
    { id: "type", header: "Type", sortingField: "type", cell: (r) => r.type },
    { id: "routing_policy", header: "Routing policy", sortingField: "routing_policy", cell: (r) => ROUTING_LABEL[r.routing_policy] },
    { id: "differentiator", header: "Differentiator", cell: differentiator },
    { id: "alias", header: "Alias", cell: (r) => (r.alias ? "Yes" : "No") },
    {
      id: "value",
      header: "Value/Route traffic to",
      width: 300,
      minWidth: 200,
      cell: (r) => <span className="r53-values">{valueText(r)}</span>,
    },
    { id: "ttl", header: "TTL (seconds)", sortingField: "ttl", cell: (r) => (r.ttl == null ? "-" : r.ttl) },
    { id: "health_check_id", header: "Health check ID", cell: (r) => r.health_check_id || "-" },
    { id: "evaluate_target_health", header: "Evaluate target health", cell: (r) => (r.alias ? (r.evaluate_target_health ? "Yes" : "No") : "-") },
    { id: "set_identifier", header: "Record ID", sortingField: "set_identifier", cell: (r) => r.set_identifier || "-" },
  ];

  const filtersActive = !!debounced || types.length > 0 || routing.length > 0 || !!aliasOpt.value;
  const clearFilters = () => {
    setFilter("");
    setTypes([]);
    setRouting([]);
    setAliasOpt(ALIAS_OPTIONS[0]);
  };

  // ------------------------------------------------------------------ split panel
  const splitPanel = (
    <SplitPanel
      header={selectedOne ? (editing ? "Edit record" : `Record details`) : selected.length > 1 ? `${selected.length} records selected` : "Record details"}
      closeBehavior="collapse"
      hidePreferencesButton={false}
      i18nStrings={{
        preferencesTitle: "Split panel preferences",
        preferencesPositionLabel: "Split panel position",
        preferencesPositionDescription: "Choose the default split panel position for the service.",
        preferencesPositionSide: "Side",
        preferencesPositionBottom: "Bottom",
        preferencesConfirm: "Confirm",
        preferencesCancel: "Cancel",
        closeButtonAriaLabel: "Close panel",
        openButtonAriaLabel: "Open panel",
        resizeHandleAriaLabel: "Resize split panel",
      }}
    >
      {!selectedOne ? (
        <Box textAlign="center" color="text-body-secondary" padding="l">
          {selected.length > 1 ? "Select a single record to view or edit its details." : "Select a record to see its details."}
        </Box>
      ) : editing ? (
        <SpaceBetween size="l">
          {selectedOne.is_default && (
            <Alert type="info">
              Route 53 created this {selectedOne.type} record when you created the hosted zone. You can change the TTL and
              values only.
            </Alert>
          )}
          <RecordFields
            draft={editing}
            onChange={setEditing}
            zoneName={zone?.name ?? ""}
            errors={editErrors}
            locked={selectedOne.is_default}
            zoneRecordNames={recordNames}
            compact
          />
          {editServerError && <Alert type="error" header="Error occurred during record update">{editServerError}</Alert>}
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="primary" loading={saving} onClick={saveRecord}>
                Save
              </Button>
            </SpaceBetween>
          </Box>
        </SpaceBetween>
      ) : (
        <SpaceBetween size="l">
          <Box float="right">
            <Button onClick={() => setEditing(recordToDraft(selectedOne, zone?.name ?? ""))}>Edit record</Button>
          </Box>
          <KeyValuePairs
            columns={1}
            items={[
              { label: "Record name", value: <CopyToClipboard variant="inline" textToCopy={selectedOne.name} copySuccessText="Record name copied" copyErrorText="Failed to copy" /> },
              { label: "Record type", value: selectedOne.type },
              {
                label: selectedOne.alias ? "Route traffic to" : "Value",
                value: (
                  <span className="r53-values r53-mono">{valueText(selectedOne)}</span>
                ),
              },
              ...(selectedOne.alias
                ? [
                    { label: "Alias target type", value: selectedOne.alias_target_type ?? "-" },
                    { label: "Evaluate target health", value: selectedOne.evaluate_target_health ? "Yes" : "No" },
                  ]
                : []),
              { label: "Alias", value: selectedOne.alias ? "Yes" : "No" },
              { label: "TTL (seconds)", value: selectedOne.ttl ?? "-" },
              { label: "Routing policy", value: ROUTING_LABEL[selectedOne.routing_policy] },
              ...(selectedOne.routing_policy !== "simple"
                ? [
                    { label: "Differentiator", value: differentiator(selectedOne) },
                    { label: "Record ID", value: selectedOne.set_identifier || "-" },
                    { label: "Health check ID", value: selectedOne.health_check_id || "-" },
                  ]
                : []),
              { label: "Last modified", value: new Date(selectedOne.updated_at).toLocaleString() },
            ]}
          />
        </SpaceBetween>
      )}
    </SplitPanel>
  );

  // ------------------------------------------------------------------ render
  const breadcrumbs = [
    { text: "Route 53", href: "/route53/v2/dashboard" },
    { text: "Hosted zones", href: HREF },
    { text: zone?.name ?? zoneId, href: `${HREF}/${zoneId}` },
  ];

  if (zoneError) {
    return (
      <ConsoleShell activeHref={HREF} breadcrumbs={breadcrumbs}>
        <Box padding={{ top: "l" }}>
          <Alert type="error" header="Hosted zone not found" action={<Button onClick={() => router.push(HREF)}>Back to hosted zones</Button>}>
            {zoneError}
          </Alert>
        </Box>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell
      activeHref={HREF}
      contentType="table"
      breadcrumbs={breadcrumbs}
      splitPanel={activeTab === "records" ? splitPanel : undefined}
      splitPanelOpen={splitOpen}
      onSplitPanelToggle={setSplitOpen}
    >
      {!zone ? (
        <Box textAlign="center" padding="xxl">
          <Spinner size="large" />
        </Box>
      ) : (
        <SpaceBetween size="l">
          <Header
            variant="h1"
            info={<InfoLink topic="hostedZones" />}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => setDeleteZoneOpen(true)}>Delete zone</Button>
                <Button onClick={() => setTestOpen(true)}>Test record</Button>
                <Button
                  onClick={() =>
                    notify({ type: "info", content: "Query logging configuration is mocked in this clone and isn't available yet." })
                  }
                >
                  Configure query logging
                </Button>
                <ButtonDropdown
                  items={[
                    { id: "json", text: "Export as JSON" },
                    { id: "bind", text: "Export as BIND zone file" },
                  ]}
                  onItemClick={({ detail }) => exportZone(detail.id as "json" | "bind")}
                >
                  Export
                </ButtonDropdown>
              </SpaceBetween>
            }
          >
            {zone.name}
            {" "}
            <Box variant="span" fontSize="heading-m" color="text-body-secondary" fontWeight="normal">
              {zone.type === "public" ? "Public" : "Private"}
            </Box>
          </Header>

          <ExpandableSection
            variant="container"
            defaultExpanded
            headerText="Hosted zone details"
            headerActions={<Button onClick={() => router.push(`${HREF}/${zone.id}/edit`)}>Edit hosted zone</Button>}
          >
            <KeyValuePairs
              columns={3}
              items={[
                { label: "Hosted zone name", value: zone.name },
                {
                  label: "Hosted zone ID",
                  value: <CopyToClipboard variant="inline" textToCopy={zone.id} copySuccessText="Hosted zone ID copied" copyErrorText="Failed to copy" />,
                },
                { label: "Description", value: zone.description || "-" },
                { label: "Query log", value: "-" },
                { label: "Type", value: zone.type === "public" ? "Public hosted zone" : "Private hosted zone" },
                { label: "Record count", value: zone.record_count },
                {
                  label: "Name servers",
                  value: zone.name_servers.length ? (
                    <SpaceBetween size="xxxs">
                      {zone.name_servers.map((ns) => (
                        <CopyToClipboard
                          key={ns}
                          variant="inline"
                          textToCopy={ns}
                          copySuccessText="Name server copied"
                          copyErrorText="Failed to copy"
                        />
                      ))}
                    </SpaceBetween>
                  ) : (
                    "-"
                  ),
                },
                ...(zone.type === "private"
                  ? [{ label: "VPC", value: `${zone.vpc_id} (${zone.vpc_region})` }]
                  : []),
                { label: "Created by", value: zone.created_by },
                { label: "Caller reference", value: zone.caller_reference },
              ]}
            />
          </ExpandableSection>

          <Tabs
            activeTabId={activeTab}
            onChange={({ detail }) => setActiveTab(detail.activeTabId)}
            tabs={[
              {
                id: "records",
                label: `Records (${zone.record_count})`,
                content: (
                  <Table<DnsRecord>
                    variant="container"
                    resizableColumns
                    enableKeyboardNavigation
                    items={records}
                    trackBy="id"
                    loading={loading}
                    loadingText="Loading records"
                    selectionType="multi"
                    selectedItems={selected}
                    onSelectionChange={({ detail }) => {
                      setSelected(detail.selectedItems);
                      if (detail.selectedItems.length) setSplitOpen(true);
                    }}
                    onRowClick={({ detail }) => {
                      setSelected([detail.item]);
                      setSplitOpen(true);
                    }}
                    ariaLabels={{
                      selectionGroupLabel: "Records selection",
                      allItemsSelectionLabel: () => "Select all records",
                      itemSelectionLabel: (_s, r) => `${r.name} ${r.type}`,
                    }}
                    columnDefinitions={columns}
                    columnDisplay={columns.map((c) => ({ id: c.id!, visible: prefs.visible.includes(c.id!) }))}
                    wrapLines={prefs.wrapLines}
                    sortingColumn={{ sortingField: sorting.col }}
                    sortingDescending={sorting.desc}
                    onSortingChange={({ detail }) =>
                      setSorting({ col: detail.sortingColumn.sortingField ?? "name", desc: !!detail.isDescending })
                    }
                    header={
                      <Header
                        counter={selected.length ? `(${selected.length}/${total})` : `(${total})`}
                        info={<InfoLink topic="records" />}
                        description="Automatic mode is the current search behavior optimized for best filter results."
                        actions={
                          <SpaceBetween direction="horizontal" size="xs">
                            <span data-shortcut-refresh>
                              <Button iconName="refresh" ariaLabel="Refresh records" onClick={refreshAll} />
                            </span>
                            <Button disabled={!selected.length} onClick={() => setDeleteRecordsOpen(true)}>
                              Delete record{selected.length > 1 ? "s" : ""}
                            </Button>
                            <Button onClick={() => router.push(`${HREF}/${zone.id}/import`)}>Import zone file</Button>
                            <span data-shortcut-create>
                              <Button variant="primary" onClick={() => router.push(`${HREF}/${zone.id}/records/create`)}>
                                Create record
                              </Button>
                            </span>
                          </SpaceBetween>
                        }
                      >
                        Records
                      </Header>
                    }
                    filter={
                      <SpaceBetween direction="horizontal" size="xs">
                        <div data-shortcut-search style={{ minWidth: 300 }}>
                          <TextFilter
                            filteringText={filter}
                            filteringPlaceholder="Filter records by property or value"
                            filteringAriaLabel="Filter records"
                            countText={filtersActive ? `${total} ${total === 1 ? "match" : "matches"}` : undefined}
                            onChange={({ detail }) => setFilter(detail.filteringText)}
                          />
                        </div>
                        <div style={{ minWidth: 160 }}>
                          <Multiselect
                            selectedOptions={types}
                            options={ALL_RECORD_TYPES}
                            placeholder="Type"
                            hideTokens
                            onChange={({ detail }) => setTypes(detail.selectedOptions)}
                          />
                        </div>
                        <div style={{ minWidth: 180 }}>
                          <Multiselect
                            selectedOptions={routing}
                            options={ROUTING_OPTIONS}
                            placeholder="Routing policy"
                            hideTokens
                            onChange={({ detail }) => setRouting(detail.selectedOptions)}
                          />
                        </div>
                        <Select
                          selectedOption={aliasOpt}
                          options={ALIAS_OPTIONS}
                          onChange={({ detail }) => setAliasOpt(detail.selectedOption as (typeof ALIAS_OPTIONS)[number])}
                        />
                        {filtersActive && <Button variant="link" onClick={clearFilters}>Clear filters</Button>}
                      </SpaceBetween>
                    }
                    pagination={
                      <Pagination
                        currentPageIndex={page}
                        pagesCount={Math.max(1, Math.ceil(total / prefs.pageSize))}
                        onChange={({ detail }) => setPage(detail.currentPageIndex)}
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
                          contentDisplay: columns.map((c) => ({ id: c.id!, visible: prefs.visible.includes(c.id!) })),
                        }}
                        onConfirm={({ detail }) =>
                          savePrefs({
                            pageSize: detail.pageSize ?? 50,
                            wrapLines: !!detail.wrapLines,
                            visible: (detail.contentDisplay ?? []).filter((c) => c.visible).map((c) => c.id),
                          })
                        }
                        pageSizePreference={{
                          title: "Page size",
                          options: [
                            { value: 10, label: "10 records" },
                            { value: 25, label: "25 records" },
                            { value: 50, label: "50 records" },
                            { value: 100, label: "100 records" },
                          ],
                        }}
                        wrapLinesPreference={{ label: "Wrap lines" }}
                        contentDisplayPreference={{
                          title: "Column preferences",
                          options: columns.map((c) => ({ id: c.id!, label: String(c.header), alwaysVisible: c.id === "name" })),
                        }}
                      />
                    }
                    empty={
                      recError ? (
                        <TableEmpty title="Error loading records" subtitle={recError} action={<Button onClick={loadRecords}>Retry</Button>} />
                      ) : filtersActive ? (
                        <TableEmpty title="No matches" subtitle="We can't find a match." action={<Button onClick={clearFilters}>Clear filter</Button>} />
                      ) : (
                        <TableEmpty
                          title="No records"
                          subtitle="This hosted zone doesn't have any records."
                          action={<Button onClick={() => router.push(`${HREF}/${zone.id}/records/create`)}>Create record</Button>}
                        />
                      )
                    }
                  />
                ),
              },
              {
                id: "dnssec",
                label: "DNSSEC signing",
                content: (
                  <Container header={<Header variant="h2" actions={<Button disabled>Enable DNSSEC signing</Button>}>DNSSEC signing</Header>}>
                    <KeyValuePairs
                      columns={2}
                      items={[
                        { label: "DNSSEC signing status", value: <StatusIndicator type="stopped">Not signing</StatusIndicator> },
                        { label: "Key-signing keys (KSKs)", value: "-" },
                      ]}
                    />
                    <Box padding={{ top: "m" }} color="text-body-secondary">
                      DNSSEC signing is mocked in this clone.
                    </Box>
                  </Container>
                ),
              },
              {
                id: "tags",
                label: `Hosted zone tags (${zone.tags.length})`,
                content: (
                  <Table
                    variant="container"
                    items={zone.tags}
                    header={
                      <Header
                        counter={`(${zone.tags.length})`}
                        actions={<Button onClick={() => router.push(`${HREF}/${zone.id}/edit`)}>Manage tags</Button>}
                      >
                        Tags
                      </Header>
                    }
                    columnDefinitions={[
                      { id: "key", header: "Key", cell: (t) => t.key, isRowHeader: true },
                      { id: "value", header: "Value", cell: (t) => t.value || "-" },
                    ]}
                    empty={<TableEmpty title="No tags" subtitle="No tags associated with the resource." />}
                  />
                ),
              },
            ]}
          />
        </SpaceBetween>
      )}

      {/* Delete records */}
      <Modal
        visible={deleteRecordsOpen}
        onDismiss={() => setDeleteRecordsOpen(false)}
        header={selected.length === 1 ? "Delete record" : `Delete ${selected.length} records`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteRecordsOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={deletingRecords} onClick={deleteRecords}>
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box>Are you sure you want to delete the following {selected.length === 1 ? "record" : "records"}?</Box>
          <Table
            variant="embedded"
            items={selected}
            columnDefinitions={[
              { id: "name", header: "Record name", cell: (r) => r.name },
              { id: "type", header: "Type", cell: (r) => r.type },
              { id: "value", header: "Value/Route traffic to", cell: (r) => <span className="r53-values">{valueText(r)}</span> },
            ]}
          />
          {selected.some((r) => r.is_default) && (
            <Alert type="warning">
              The SOA and NS records that Route 53 created for the zone apex can&apos;t be deleted and will be skipped.
            </Alert>
          )}
        </SpaceBetween>
      </Modal>

      {/* Test record (mocked) */}
      <Modal
        visible={testOpen}
        onDismiss={() => setTestOpen(false)}
        header="Test record"
        footer={
          <Box float="right">
            <Button variant="primary" onClick={() => setTestOpen(false)}>
              Close
            </Button>
          </Box>
        }
      >
        The DNS response test tool isn&apos;t available in this clone because records aren&apos;t served by a real DNS
        resolver.
      </Modal>

      {zone && (
        <DeleteZoneModal
          zones={[zone]}
          visible={deleteZoneOpen}
          busy={deletingZone}
          onDismiss={() => setDeleteZoneOpen(false)}
          onConfirm={deleteZone}
        />
      )}
    </ConsoleShell>
  );
}
