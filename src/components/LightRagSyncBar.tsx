import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useAppStore } from "../store/appStore";
import Api from "../Api";
import "../styles/LightRagSyncBar.scss";

const POLL_INTERVAL = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max before giving up

interface FailedDoc {
  filePath: string;
  error: string | null;
  pageId: string | null;
  title: string;
  type: string | null;
}

const LightRagSyncBar: React.FC = () => {
  const isDM = useAppStore((s) => s.isDM());
  const lightRagSyncTick = useAppStore((s) => s.lightRagSyncTick);
  const navigate = useNavigate();

  const [visible, setVisible] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<any>(null);
  const [failedOpen, setFailedOpen] = useState(false);
  const [failedDocs, setFailedDocs] = useState<FailedDoc[]>([]);
  const [failedLoading, setFailedLoading] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTickRef = useRef(lightRagSyncTick);
  const popoverRef = useRef<HTMLDivElement>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const checkFailuresOnStop = useCallback(async () => {
    try {
      const data = await Api.getLightRagFailedDocuments();
      const failures = data?.failed ?? [];
      if (failures.length > 0) {
        // Update the pipeline status bar to reflect actual failure count
        setPipelineStatus((prev: any) => ({ ...prev, busy: false, request_failed: failures.length }));
        toast.error(
          `LightRAG: ${failures.length} document${failures.length > 1 ? "s" : ""} failed processing. Check the sync bar for details.`,
          { duration: 8000 }
        );
      } else {
        setVisible(false);
      }
    } catch {
      setVisible(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    const startedAt = Date.now();
    intervalRef.current = setInterval(async () => {
      try {
        const status = await Api.getLightRagPipelineStatus();
        setPipelineStatus(status);
        const timedOut = Date.now() - startedAt > POLL_TIMEOUT_MS;
        if (!status?.busy || timedOut) {
          stopPolling();
          if (timedOut && status?.busy) {
            toast.error("LightRAG is taking too long — check for failures in the sync bar.", { duration: 8000 });
          }
          await checkFailuresOnStop();
        }
      } catch (err) {
        console.error("[LightRagSyncBar] poll error:", err);
      }
    }, POLL_INTERVAL);
  }, [stopPolling, checkFailuresOnStop]);

  // On mount: single call — show and start polling only if already busy
  useEffect(() => {
    if (!isDM) return;
    Api.getLightRagPipelineStatus()
      .then((status) => {
        setPipelineStatus(status);
        if (status?.busy) {
          setVisible(true);
          startPolling();
        }
      })
      .catch((err) => {
        console.error("[LightRagSyncBar] mount check failed:", err);
      });
    return stopPolling;
  }, [isDM]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a sync is triggered externally (toggle or batch)
  useEffect(() => {
    if (!isDM) return;
    if (lightRagSyncTick === prevTickRef.current) return;
    prevTickRef.current = lightRagSyncTick;
    setVisible(true);
    startPolling();
  }, [lightRagSyncTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close popover on outside click
  useEffect(() => {
    if (!failedOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setFailedOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [failedOpen]);

  const openFailedPopover = async () => {
    if (failedOpen) { setFailedOpen(false); return; }
    setFailedOpen(true);
    setFailedLoading(true);
    try {
      const data = await Api.getLightRagFailedDocuments();
      setFailedDocs(data.failed ?? []);
    } catch {
      setFailedDocs([]);
    } finally {
      setFailedLoading(false);
    }
  };

  const handleFailedItemClick = (doc: FailedDoc) => {
    if (doc.pageId && doc.type) {
      navigate(`/lore/${doc.type}/${doc.pageId}`);
      setFailedOpen(false);
    }
  };

  if (!isDM || !visible) return null;

  const pending    = pipelineStatus?.request_pending     ?? "…";
  const inProgress = pipelineStatus?.request_in_progress ?? "…";
  const done       = pipelineStatus?.request_done        ?? "…";
  const failed     = pipelineStatus?.request_failed      ?? 0;
  const isBusy     = pipelineStatus?.busy ?? true;

  return (
    <div className="lr-sync-bar">
      <div className="lr-sync-bar__track">
        {isBusy && <div className="lr-sync-bar__fill lr-sync-bar__fill--animated" />}
      </div>

      <div className="lr-sync-bar__label">
        <span className="lr-sync-bar__caption">LightRAG</span>
        <span className="lr-sync-bar__stats">
          {pipelineStatus ? (
            <>
              <span className="lr-sync-bar__stat lr-sync-bar__stat--pending">{pending} pending</span>
              <span className="lr-sync-bar__sep">·</span>
              <span className="lr-sync-bar__stat lr-sync-bar__stat--active">{inProgress} processing</span>
              <span className="lr-sync-bar__sep">·</span>
              <span className="lr-sync-bar__stat lr-sync-bar__stat--done">{done} done</span>
              {failed > 0 && (
                <>
                  <span className="lr-sync-bar__sep">·</span>
                  <button
                    className="lr-sync-bar__stat lr-sync-bar__stat--failed lr-sync-bar__failed-btn"
                    onClick={openFailedPopover}
                    title="Click to see failed documents"
                  >
                    {failed} failed
                  </button>
                </>
              )}
            </>
          ) : (
            <span>connecting…</span>
          )}
        </span>
      </div>

      {failedOpen && (
        <div className="lr-sync-bar__popover" ref={popoverRef}>
          <div className="lr-sync-bar__popover-header">
            <span>Failed documents</span>
            <button className="lr-sync-bar__popover-close" onClick={() => setFailedOpen(false)}>×</button>
          </div>
          <div className="lr-sync-bar__popover-body">
            {failedLoading ? (
              <span className="lr-sync-bar__popover-empty">Loading…</span>
            ) : failedDocs.length === 0 ? (
              <span className="lr-sync-bar__popover-empty">No failed documents found.</span>
            ) : (
              <ul className="lr-sync-bar__popover-list">
                {failedDocs.map((doc) => (
                  <li key={doc.filePath} className="lr-sync-bar__popover-item">
                    <button
                      className="lr-sync-bar__popover-link"
                      onClick={() => handleFailedItemClick(doc)}
                      disabled={!doc.pageId}
                      title={doc.error ?? undefined}
                    >
                      {doc.title}
                    </button>
                    {doc.error && (
                      <span className="lr-sync-bar__popover-error">{doc.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <button
        className="lr-sync-bar__dismiss"
        onClick={() => { setVisible(false); stopPolling(); setFailedOpen(false); }}
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
};

export default LightRagSyncBar;
