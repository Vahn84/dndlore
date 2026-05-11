import React, { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { useAppStore } from "../store/appStore";
import Api from "../Api";
import "../styles/IngestSyncBar.scss";
import IngestReviewPanel from "./IngestReviewPanel";

/**
 * Top-of-screen (well — bottom, above LightRagSyncBar) progress strip for
 * wiki ingest dry-run. SSE-driven, no polling. Phases:
 *   idle      → not visible
 *   planning  → "Pianifico…"
 *   proposing → "n/N — <slug>"
 *   ready     → "N proposte pronte"  (click to open panel)
 *   error     → "Errore: …"
 */
const IngestSyncBar: React.FC = () => {
  const isDM = useAppStore((s) => s.isDM());
  const ingestTick = useAppStore((s) => s.ingestTick);
  const ingestRequest = useAppStore((s) => s.ingestRequest);
  const session = useAppStore((s) => s.ingestSession);
  const setIngestState = useAppStore((s) => s.setIngestState);
  const pushIngestProposal = useAppStore((s) => s.pushIngestProposal);
  const openIngestPanel = useAppStore((s) => s.openIngestPanel);
  const resetIngest = useAppStore((s) => s.resetIngest);

  const prevTickRef = useRef(ingestTick);
  const abortRef = useRef<AbortController | null>(null);

  // Kick off SSE when triggerIngest fires.
  useEffect(() => {
    if (!isDM) return;
    if (ingestTick === prevTickRef.current) return;
    prevTickRef.current = ingestTick;
    if (!ingestRequest) return;

    const ac = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ac;

    (async () => {
      try {
        const resp = await fetch(
          `${Api.getBaseUrl()}/sync/wiki/ingest/dry-run/stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
              Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
            },
            body: JSON.stringify(ingestRequest),
            signal: ac.signal,
          }
        );
        if (!resp.ok || !resp.body) {
          let msg = "Ingest failed";
          try {
            const j = await resp.json();
            msg = j?.error || msg;
          } catch {}
          throw new Error(msg);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const processFrame = (frame: string) => {
          const lines = frame.split("\n");
          let eventName = "message";
          let dataStr = "";
          for (const l of lines) {
            if (l.startsWith("event:")) eventName = l.slice(6).trim();
            else if (l.startsWith("data:")) dataStr += l.slice(5).trim();
          }
          if (!dataStr) return;
          let payload: any;
          try {
            payload = JSON.parse(dataStr);
          } catch {
            return;
          }

          if (eventName === "plan") {
            setIngestState({
              state: "proposing",
              plan: payload.plan,
              total: payload.plan?.entities_touched?.length ?? 0,
            });
          } else if (eventName === "page_start") {
            setIngestState({
              currentSlug: payload.slug,
              currentIndex: payload.current,
              total: payload.total,
            });
          } else if (eventName === "page_done") {
            pushIngestProposal(payload);
          } else if (eventName === "done") {
            setIngestState({ state: "ready" });
            toast.success("Proposte di ingest pronte — apri il pannello per revisionare", {
              duration: 8000,
            });
          } else if (eventName === "error") {
            setIngestState({ state: "error", error: payload.message });
            toast.error(`Ingest fallito: ${payload.message}`);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) processFrame(buffer);
            buffer = "";
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\n\n/);
          buffer = frames.pop() ?? "";
          for (const f of frames) processFrame(f);
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setIngestState({ state: "error", error: err?.message || "Stream failed" });
        toast.error(err?.message || "Ingest fallito");
      }
    })();

    return () => ac.abort();
  }, [ingestTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!isDM || session.state === "idle") return null;

  const total = session.total ?? 0;
  const proposed = session.proposals.length;
  const errors = session.proposals.filter((p: any) => p.error).length;
  const percent =
    total > 0 && session.state === "proposing"
      ? Math.min(100, Math.round((proposed / total) * 100))
      : 0;

  const isAnimated = session.state === "planning" || session.state === "proposing";
  const isReady = session.state === "ready";
  const isError = session.state === "error";

  return (
    <>
      <div
        className={`ingest-sync-bar${isReady ? " ingest-sync-bar--ready" : ""}${
          isError ? " ingest-sync-bar--error" : ""
        }`}
        onClick={isReady ? () => openIngestPanel() : undefined}
      >
        <div className="ingest-sync-bar__track">
          <div
            className={`ingest-sync-bar__fill${
              isAnimated ? " ingest-sync-bar__fill--animated" : ""
            }`}
            style={!isAnimated ? { width: `${percent || 100}%` } : undefined}
          />
        </div>

        <div className="ingest-sync-bar__label">
          <span className="ingest-sync-bar__caption">Wiki Ingest</span>
          <span className="ingest-sync-bar__stats">
            {session.state === "planning" && <span>pianifico…</span>}
            {session.state === "proposing" && (
              <>
                <span>
                  {proposed}/{total}
                </span>
                {session.currentSlug && (
                  <>
                    <span className="ingest-sync-bar__sep">·</span>
                    <span>elabora <code>{session.currentSlug}</code></span>
                  </>
                )}
              </>
            )}
            {session.state === "ready" && (
              <>
                <span>{proposed} proposte pronte</span>
                {errors > 0 && (
                  <>
                    <span className="ingest-sync-bar__sep">·</span>
                    <span>{errors} errori</span>
                  </>
                )}
              </>
            )}
            {session.state === "error" && <span>{session.error}</span>}
          </span>
        </div>

        {isReady && (
          <button
            className="ingest-sync-bar__btn"
            onClick={(e) => {
              e.stopPropagation();
              openIngestPanel();
            }}
          >
            Revisiona →
          </button>
        )}

        <button
          className="ingest-sync-bar__dismiss"
          title="Chiudi"
          onClick={(e) => {
            e.stopPropagation();
            abortRef.current?.abort();
            resetIngest();
          }}
        >
          ×
        </button>
      </div>

      <IngestReviewPanel />
    </>
  );
};

export default IngestSyncBar;
