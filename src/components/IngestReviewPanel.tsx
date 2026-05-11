import React, { useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { useAppStore } from "../store/appStore";
import Api from "../Api";

type Proposal = {
  slug: string;
  action: "create" | "update";
  proposed_md?: string;
  existing_md?: string | null;
  link_fixes?: Array<{ from: string; to: string; reason: string }>;
  unresolved_links?: string[];
  unresolved_new?: string[];
  unresolved_known_stubs?: string[];
  frontmatter_restored?: string[];
  error?: string;
};

const IngestReviewPanel: React.FC = () => {
  const session = useAppStore((s) => s.ingestSession);
  const closeIngestPanel = useAppStore((s) => s.closeIngestPanel);

  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Default-approve every proposal that came through without error
  React.useEffect(() => {
    if (!session.panelOpen) return;
    const okSlugs = session.proposals
      .filter((p: Proposal) => !p.error)
      .map((p: Proposal) => p.slug);
    setApproved(new Set(okSlugs));
  }, [session.panelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = session.plan;
  const proposals = (session.proposals || []) as Proposal[];

  const newEntities = useMemo(
    () => (plan?.entities_touched || []).filter((e: any) => e.action === "create"),
    [plan]
  );

  if (!session.panelOpen) return null;

  const toggleApprove = (slug: string) => {
    setApproved((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleExpand = (slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const [applying, setApplying] = useState(false);

  const onApply = async () => {
    if (approved.size === 0) return;
    const toApply = proposals
      .filter((p) => approved.has(p.slug) && !p.error && p.proposed_md)
      .map((p) => ({
        slug: p.slug,
        action: p.action,
        proposed_md: p.proposed_md,
      }));
    if (toApply.length === 0) {
      toast.error("Nessuna proposta valida da applicare");
      return;
    }
    setApplying(true);
    const tId = toast.loading(`Scrittura ${toApply.length} pagine…`, {
      id: "ingest-apply",
    });
    try {
      const resp = await fetch(`${Api.getBaseUrl()}/sync/wiki/ingest/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({ proposals: toApply }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Apply failed");
      const ok = data.applied?.length ?? 0;
      const fail = data.errors?.length ?? 0;
      if (fail === 0) {
        toast.success(`✓ ${ok} pagine scritte sul wiki`, { id: tId });
      } else {
        toast.error(
          `${ok} scritte, ${fail} errori — vedi console`,
          { id: tId, duration: 8000 }
        );
        // eslint-disable-next-line no-console
        console.warn("[ingest/apply] errors:", data.errors);
      }
      // Close panel on success (full or partial).
      closeIngestPanel();
    } catch (e: any) {
      toast.error(e?.message || "Apply fallito", { id: tId });
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <div className="ingest-panel__backdrop" onClick={closeIngestPanel} />
      <aside className="ingest-panel" role="dialog" aria-label="Wiki ingest review">
        <header className="ingest-panel__header">
          <div>
            <div className="ingest-panel__title">Wiki Ingest — Dry-run</div>
            {plan?.source?.title && (
              <div className="ingest-panel__subtitle">{plan.source.title}</div>
            )}
          </div>
          <button className="ingest-panel__close" onClick={closeIngestPanel} aria-label="Chiudi">
            ×
          </button>
        </header>

        <div className="ingest-panel__body">
          {/* Plan summary */}
          {plan && (
            <div className="ingest-panel__summary">
              <div>
                <strong>{proposals.length}</strong> pagine proposte
                {newEntities.length > 0 && (
                  <>
                    {" · "}
                    <strong>{newEntities.length}</strong> nuove
                  </>
                )}
                {plan.session_page?.slug && (
                  <>
                    {" · "}
                    <strong>Sessione:</strong> <code>{plan.session_page.slug}</code>
                  </>
                )}
              </div>
              {plan.open_questions_new?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong>Nuove domande aperte:</strong>
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    {plan.open_questions_new.map((q: string, i: number) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.notes && (
                <div style={{ marginTop: 8, opacity: 0.85, fontStyle: "italic" }}>
                  {plan.notes}
                </div>
              )}
            </div>
          )}

          {/* Bulk approve toggles */}
          {proposals.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                fontSize: "0.78rem",
                opacity: 0.85,
                paddingBottom: 4,
              }}
            >
              <span style={{ opacity: 0.6 }}>Approvazione rapida:</span>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setApproved(
                    new Set(
                      proposals.filter((p) => !p.error).map((p) => p.slug)
                    )
                  );
                }}
                style={{ color: "var(--accent, #c9a96e)" }}
              >
                tutte
              </a>
              <span style={{ opacity: 0.4 }}>·</span>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setApproved(new Set());
                }}
                style={{ color: "var(--accent, #c9a96e)" }}
              >
                nessuna
              </a>
              <span style={{ opacity: 0.4 }}>·</span>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  // only updates (existing pages, safer)
                  setApproved(
                    new Set(
                      proposals
                        .filter((p) => !p.error && p.action === "update")
                        .map((p) => p.slug)
                    )
                  );
                }}
                style={{ color: "var(--accent, #c9a96e)" }}
              >
                solo update
              </a>
            </div>
          )}

          {/* Per-proposal cards */}
          {proposals.map((p) => (
            <ProposalCard
              key={p.slug}
              proposal={p}
              isApproved={approved.has(p.slug)}
              isExpanded={expanded.has(p.slug)}
              onToggleApprove={() => toggleApprove(p.slug)}
              onToggleExpand={() => toggleExpand(p.slug)}
            />
          ))}
        </div>

        <footer className="ingest-panel__footer">
          <button className="ingest-panel__cancel" onClick={closeIngestPanel}>
            Annulla
          </button>
          <button
            className="ingest-panel__apply"
            onClick={onApply}
            disabled={approved.size === 0 || applying}
          >
            {applying
              ? "Applicando…"
              : `Applica ${approved.size > 0 ? `${approved.size} proposte` : ""}`}
          </button>
        </footer>
      </aside>
    </>
  );
};

const ProposalCard: React.FC<{
  proposal: Proposal;
  isApproved: boolean;
  isExpanded: boolean;
  onToggleApprove: () => void;
  onToggleExpand: () => void;
}> = ({ proposal: p, isApproved, isExpanded, onToggleApprove, onToggleExpand }) => {
  const isErr = !!p.error;

  return (
    <div className={`ingest-card${isApproved && !isErr ? " ingest-card--approved" : ""}`}>
      <div className="ingest-card__header">
        <span className="ingest-card__title">{p.slug}</span>
        <span className={`ingest-card__badge ingest-card__badge--${p.action}`}>
          {p.action}
        </span>
        {!isErr && (
          <label className="ingest-card__check">
            <input
              type="checkbox"
              checked={isApproved}
              onChange={onToggleApprove}
            />
            <span>Applica</span>
          </label>
        )}
      </div>

      {isErr ? (
        <div className="ingest-card__meta" style={{ color: "#f3a09a" }}>
          Errore: {p.error}
        </div>
      ) : (
        <>
          <div className="ingest-card__meta">
            {(p.proposed_md?.length ?? 0).toLocaleString()} caratteri
            {p.existing_md != null && (
              <> · {(p.existing_md.length ?? 0).toLocaleString()} esistenti</>
            )}
          </div>

          {p.frontmatter_restored && p.frontmatter_restored.length > 0 && (
            <div
              className="ingest-card__fixes"
              style={{ color: "rgba(174, 213, 255, 0.85)" }}
            >
              🛡 frontmatter protetto: <code>{p.frontmatter_restored.join(", ")}</code>
            </div>
          )}

          {p.link_fixes && p.link_fixes.length > 0 && (
            <div className="ingest-card__fixes">
              ✓ {p.link_fixes.length} link auto-corretti
              {isExpanded && (
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                  {p.link_fixes.map((f, i) => (
                    <li key={i}>
                      <code>{f.from}</code> → <code>{f.to}</code> <em>({f.reason})</em>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {p.unresolved_new && p.unresolved_new.length > 0 && (
            <div className="ingest-card__unresolved">
              ⚠ {p.unresolved_new.length} nuovi non risolti (Gemma)
              {isExpanded && (
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                  {p.unresolved_new.map((u, i) => (
                    <li key={i}>
                      <code>{u}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {p.unresolved_known_stubs && p.unresolved_known_stubs.length > 0 && (
            <div
              className="ingest-card__unresolved"
              style={{ color: "rgba(180,180,180,0.7)" }}
            >
              ◦ {p.unresolved_known_stubs.length} stub già nel wiki (backlog)
              {isExpanded && (
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                  {p.unresolved_known_stubs.map((u, i) => (
                    <li key={i}>
                      <code>{u}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button className="ingest-card__toggle" onClick={onToggleExpand}>
            {isExpanded ? "Nascondi diff ▲" : "Mostra diff ▼"}
          </button>

          {isExpanded && (
            <div className="ingest-card__diff">
              {p.action === "update" && (
                <div>
                  <span className="ingest-card__pane-label">Esistente</span>
                  <pre className="ingest-card__pane">{p.existing_md || "(vuoto)"}</pre>
                </div>
              )}
              <div style={p.action === "create" ? { gridColumn: "1 / -1" } : undefined}>
                <span className="ingest-card__pane-label">Proposta</span>
                <pre className="ingest-card__pane">{p.proposed_md}</pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IngestReviewPanel;
