"use client";

import React, { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import {
  fetchDuplicateGroups,
  ownerMergeGuests,
  type DuplicateCandidate,
} from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import { Card, Button, Loading } from "@/components/ui";

export default function DuplicatesPage() {
  const { wedding } = useWedding();
  const [groupsData, setGroupsData] = useState<DuplicateCandidate[][] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const reload = async () => {
    if (!wedding) return;
    const g = await fetchDuplicateGroups(wedding.id);
    setGroupsData(g);
  };

  useEffect(() => {
    if (!wedding) return;
    fetchDuplicateGroups(wedding.id)
      .then(setGroupsData)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Couldn't load.");
        setGroupsData([]);
      });
  }, [wedding]);

  const visible = useMemo(() => {
    if (!groupsData) return [];
    return groupsData.filter((g) => !dismissed.has(groupKey(g)));
  }, [groupsData, dismissed]);

  const merge = async (sourceId: string, targetId: string) => {
    setBusy(sourceId);
    setError(null);
    try {
      await ownerMergeGuests(sourceId, targetId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="u-main">
      <BackHeader
        title="Possible duplicates"
        subtitle="Guests with the same name — usually a child two co-parents both added"
        fallback="/guests"
      />

      {groupsData === null && <Loading />}

      {groupsData !== null && visible.length === 0 && (
        <Card style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 15, color: T.ink }}>Nothing to review.</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>
            No matching names in your guest list.
          </div>
        </Card>
      )}

      {error && (
        <div className="error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {visible.map((group) => {
        const key = groupKey(group);
        return (
          <Card key={key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              {group[0].first_name} {group[0].last_name ?? ""}{" "}
              <span style={{ fontWeight: 400, color: T.muted, fontSize: 12 }}>
                · {group[0].kind === "child" ? "child" : "adult"} · {group.length} matches
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
              Pick the row that should stay. The others will be folded into it
              (relationships, RSVP, and dietary notes are preserved on the target).
            </div>
            <GroupRows
              group={group}
              busyId={busy}
              onMerge={(sourceId, targetId) => void merge(sourceId, targetId)}
            />
            <button
              type="button"
              onClick={() =>
                setDismissed((prev) => new Set(prev).add(key))
              }
              style={{
                marginTop: 10,
                background: "transparent",
                border: "none",
                color: T.muted,
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              These are different people — hide
            </button>
          </Card>
        );
      })}
    </main>
  );
}

function GroupRows({
  group,
  busyId,
  onMerge,
}: {
  group: DuplicateCandidate[];
  busyId: string | null;
  onMerge: (sourceId: string, targetId: string) => void;
}) {
  const [targetId, setTargetId] = useState<string>(group[0].id);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {group.map((g) => {
        const isTarget = g.id === targetId;
        return (
          <div
            key={g.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              border: isTarget
                ? "1px solid rgba(67,53,58,.35)"
                : "1px solid rgba(67,53,58,.12)",
              background: isTarget ? "rgba(224,204,177,.35)" : "#fff",
            }}
          >
            <input
              type="radio"
              name={`target-${group[0].first_name}`}
              checked={isTarget}
              onChange={() => setTargetId(g.id)}
            />
            <div style={{ flex: 1, fontSize: 13 }}>
              <div style={{ color: T.ink }}>
                {g.first_name} {g.last_name ?? ""}
              </div>
              <div style={{ fontSize: 11.5, color: T.faint }}>
                {g.email || g.phone || "no contact info"}
                {g.guest_group ? ` · ${g.guest_group}` : ""}
                {g.rsvp_status && g.rsvp_status !== "pending"
                  ? ` · RSVP: ${g.rsvp_status}`
                  : ""}
                {g.added_by_first_name ? ` · added by ${g.added_by_first_name}` : ""}
              </div>
            </div>
            {!isTarget && (
              <Button
                variant="secondary"
                onClick={() => onMerge(g.id, targetId)}
                disabled={busyId === g.id}
                style={{ minHeight: 34, fontSize: 12 }}
              >
                {busyId === g.id ? "…" : "Merge into selected"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function groupKey(group: DuplicateCandidate[]): string {
  return group
    .map((g) => g.id)
    .sort()
    .join("|");
}
