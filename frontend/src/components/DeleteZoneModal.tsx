"use client";

import { useEffect, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import type { HostedZone } from "@/lib/types";

export default function DeleteZoneModal({
  zones,
  visible,
  busy,
  onDismiss,
  onConfirm,
}: {
  zones: HostedZone[];
  visible: boolean;
  busy: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const [text, setText] = useState("");
  useEffect(() => setText(""), [visible]);
  const nonEmpty = zones.filter((z) => z.record_count > 2);
  const single = zones.length === 1;
  const ok = text === "delete";

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={single ? "Delete hosted zone?" : `Delete ${zones.length} hosted zones?`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!ok} loading={busy} onClick={onConfirm}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box>
          {single ? (
            <>
              Delete hosted zone <b>{zones[0]?.name}</b> permanently? This action can&apos;t be undone.
            </>
          ) : (
            <>
              Delete the following hosted zones permanently? This action can&apos;t be undone.
              <ul>
                {zones.map((z) => (
                  <li key={z.id}>
                    <b>{z.name}</b> ({z.id})
                  </li>
                ))}
              </ul>
            </>
          )}
        </Box>
        {nonEmpty.length > 0 && (
          <Alert type="warning" header="Hosted zone contains records">
            {nonEmpty.map((z) => z.name).join(", ")} {nonEmpty.length === 1 ? "contains" : "contain"} records other than
            the default NS and SOA records. Route 53 can&apos;t delete a hosted zone that contains other records. Delete those
            records first.
          </Alert>
        )}
        <Alert type="info">
          If the domain is registered and Route 53 is the DNS service for it, deleting the hosted zone makes the domain
          unavailable on the internet.
        </Alert>
        <FormField label={<span>To confirm deletion, enter <i>delete</i> in the field.</span>}>
          <Input
            value={text}
            placeholder="delete"
            ariaLabel="Confirm deletion"
            onChange={({ detail }) => setText(detail.value)}
            onKeyDown={({ detail }) => {
              if (detail.key === "Enter" && ok) onConfirm();
            }}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}
