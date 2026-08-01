"use client";

import React, { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { useWedding } from "@/lib/wedding";
import {
  fetchDuplicateGroups,
  fetchHiddenDuplicateClusters,
  hideDuplicateCluster,
  unhideDuplicateCluster,
  type DuplicateCandidate,
} from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import { Card, Button, Loading } from "@/components/ui";
import { MergeReviewPanel } from "@/components/MergeReviewPanel";

function ageOrEmpty(a: number | null): string {
  return a != null ? `${a}y` : "";
}

function groupKey(group: DuplicateCandidate[]): string {
  return group.map((g) => g.id).sort().join(",");
}

export default function DuplicatesPage() {
  const { wedding } = useWedding();
  const [groupsData, setGroupsData] = useState<DuplicateCandidate[][] | null>(null);
  const [hidden, setHidden] = useState<DuplicateCandidate[][]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    if (!wedding) return;
    const [live, hid] = await Promise.all([
      fetchDuplicateGroups(wedding.id),
      fetchHiddenDuplicateClusters(wedding.id),
    ]);
    setGroupsData(live);
    setHidden(hid);
  };

  useEffect(() => {
    if (!wedding) return;
    Promise.all([
      fetchDuplicateGroups(wedding.id),
      fetchHiddenDuplicateClusters(wedding.id),
    ])
      .then(([live, hid]) => {
        setGroupsData(live);
        setHidden(hid);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Couldn't load.");
        setGroupsData([]);
        setHidden([]);
      });
  }, [wedding]);

  const dismiss = async (group: DuplicateCandidate[]) => {
    if (!wedding) return;
    const key = groupKey(group);
    setBusyKey(key);
    try {
      await hideDuplicateCluster(
        wedding.id,
        group.map((g) => g.id),
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't hide.");
    } finally {
      setBusyKey(null);
    }
  };

  const restore = async (group: DuplicateCandidate[]) => {
    if (!wedding) return;
    const key = groupKey(group);
    setBusyKey(key);
    try {
      await unhideDuplicateCluster(
        wedding.id,
        group.map((g) => g.id),
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't restore.");
    } finally {
      setBusyKey(null);
    }
  };

  const totalLive = groupsData?.length ?? 0;
  const totalHidden = hidden.length;

  return (
    <main className="u-main">
      <BackHeader
        title="Possible duplicates"
        subtitle="Guests with the same name — usually a child two co-parents both added"
        fallback="/guests"
      />

      {groupsData === null && <Loading />}

      {groupsData !== null && totalLive === 0 && (
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

      {groupsData?.map((group) => {
        const key = groupKey(group);
        return (
          <ClusterCard
            key={key}
            cluster={group}
            reviewing={reviewingKey === key}
            busy={busyKey === key}
            onStartReview={() => setReviewingKey(key)}
            onCancelReview={() => setReviewingKey(null)}
            onMerged={() => {
              setReviewingKey(null);
              void reload();
            }}
            onHide={() => void dismiss(group)}
            hidden={false}
          />
        );
      })}

      {totalHidden > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            className="u-link"
            style={{
              fontSize: 13,
              color: T.muted,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {showHidden ? "▾" : "▸"} {totalHidden} hidden suggestion
            {totalHidden === 1 ? "" : "s"}
          </button>
          {showHidden && (
            <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
              {hidden.map((group) => {
                const key = groupKey(group);
                return (
                  <ClusterCard
                    key={key}
                    cluster={group}
                    reviewing={reviewingKey === key}
                    busy={busyKey === key}
                    onStartReview={() => setReviewingKey(key)}
                    onCancelReview={() => setReviewingKey(null)}
                    onMerged={() => {
                      setReviewingKey(null);
                      void reload();
                    }}
                    onHide={() => void restore(group)}
                    hidden={true}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function ClusterCard({
  cluster,
  reviewing,
  busy,
  onStartReview,
  onCancelReview,
  onMerged,
  onHide,
  hidden,
}: {
  cluster: DuplicateCandidate[];
  reviewing: boolean;
  busy: boolean;
  onStartReview: () => void;
  onCancelReview: () => void;
  onMerged: () => void;
  onHide: () => void;
  hidden: boolean;
}) {
  return (
    <Card style={{ marginBottom: 14, opacity: hidden ? 0.82 : 1 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        {cluster[0].first_name} {cluster[0].last_name ?? ""}{" "}
        <span style={{ fontWeight: 400, color: T.muted, fontSize: 12 }}>
          · {cluster.length} matches
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cluster.map((g) => (
          <div
            key={g.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(67,53,58,.12)",
              background: "#fff",
            }}
          >
            <div style={{ flex: 1, fontSize: 13 }}>
              <div style={{ color: T.ink }}>
                {g.first_name} {g.last_name ?? ""}
                {g.age_years != null ? ` · ${ageOrEmpty(g.age_years)}` : ""}
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
          </div>
        ))}
      </div>

      {reviewing ? (
        <div style={{ marginTop: 12 }}>
          <MergeReviewPanel
            guests={cluster}
            onDone={onMerged}
            onCancel={onCancelReview}
          />
        </div>
      ) : (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {hidden ? (
            <>
              <Button
                variant="secondary"
                onClick={onHide}
                disabled={busy}
                style={{ minHeight: 36, fontSize: 13 }}
              >
                {busy ? "…" : "Restore suggestion"}
              </Button>
              <Button
                onClick={onStartReview}
                disabled={busy}
                style={{ minHeight: 36, fontSize: 13 }}
              >
                Review merge
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={onStartReview}
                disabled={busy}
                style={{ minHeight: 36, fontSize: 13, flex: 1 }}
              >
                Review merge
              </Button>
              <button
                type="button"
                onClick={onHide}
                disabled={busy}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.muted,
                  fontSize: 12,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                {busy ? "…" : "These are different people — hide"}
              </button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
