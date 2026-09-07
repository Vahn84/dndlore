import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useAppStore } from "../store/appStore";
import { wikiTask } from "../utils/wikiTask";
import WikiTaskFeedback, { RejectedWikiProposal } from "./WikiTaskFeedback";

export default function WikiMaintenance() {
  const [question, setQuestion] = useState("");
  const [spoilers, setSpoilers] = useState(false);
  const [answer, setAnswer] = useState<{ content: string; query_id: string }>();
  const [report, setReport] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [rejected, setRejected] = useState<RejectedWikiProposal[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [busy, setBusy] = useState("");
  const controller = useRef<AbortController | null>(null);
  const sessionState = useAppStore(s => s.ingestSession.state);
  useEffect(() => () => controller.current?.abort(), []);
  const run = async (operation: "query" | "lint" | "query-save" | "reindex") => {
    if (busy) return;
    setBusy(operation);
    setErrorMessage("");
    if (operation === "lint" || operation === "query-save") {
      setReport(""); setRejected([]); setReviewCount(0);
    }
    const ac = new AbortController(); controller.current = ac;
    try {
      const data = await wikiTask<any>(operation, { question, include_spoilers: spoilers, query_id: answer?.query_id }, ac.signal);
      if (operation === "query") setAnswer(data);
      else if (operation === "reindex") toast.success(`Index updated: ${data.pages} pages`);
      else {
        setReport(data.report);
        setRejected(data.rejected_proposals || []);
        if (data.proposals?.length) {
          const store = useAppStore.getState();
          if (store.ingestSession.state !== "idle") throw new Error("An ingestion started while this task was running. Finish it, then rerun this review.");
          store.resetIngest();
          store.setIngestState({ state: "ready", plan: data.plan, proposals: data.proposals, panelOpen: true });
          setReviewCount(data.proposals.length);
        }
      }
    } catch (error: unknown) {
      if (!ac.signal.aborted) {
        const message = `${operation}: ${error instanceof Error ? error.message : "Wiki operation failed"}`;
        setErrorMessage(message);
        toast.error(message);
      } else setErrorMessage(`${operation}: Request cancelled. Check the wiki before retrying an index repair.`);
    }
    finally { setBusy(""); controller.current = null; }
  };
  const disabled = !!busy || sessionState !== "idle";
  return <section className="dm-settings__card">
    <h2 className="dm-settings__card-title">Wiki knowledge & maintenance</h2>
    <p className="dm-settings__hint">Uses the saved agent selection. Answers can become cited wiki pages after review; lint proposes repairs. The agent maintains the index automatically after approved changes.</p>
    <div className="dm-settings__field">
      <label className="dm-settings__label" htmlFor="wiki-question">Ask the wiki</label>
      <textarea id="wiki-question" className="dm-settings__textarea" rows={3} value={question} onChange={e => setQuestion(e.target.value)} />
      <div className="checkbox-wrapper dm-settings__checkbox">
        <input
          id="wiki-include-spoilers"
          className="input-checkbox input-checkbox-light"
          type="checkbox"
          checked={spoilers}
          onChange={e => setSpoilers(e.target.checked)}
          aria-labelledby="wiki-include-spoilers-label"
        />
        <label className="input-checkbox-btn" htmlFor="wiki-include-spoilers" aria-hidden="true" />
        <label id="wiki-include-spoilers-label" className="form-label" htmlFor="wiki-include-spoilers">
          Include DM secrets
        </label>
      </div>
    </div>
    <div className="dm-settings__actions" style={{ flexWrap: "wrap", gap: 12 }}>
      <button className="dm-settings__save-btn" disabled={disabled || !question.trim()} onClick={() => run("query")}>Ask</button>
      <button className="dm-settings__save-btn" disabled={disabled} onClick={() => run("lint")}>Lint wiki</button>
      <button className="dm-settings__save-btn" disabled={!!busy} onClick={() => run("reindex")}>Repair index</button>
      {busy && <button className="dm-settings__save-btn" onClick={() => controller.current?.abort()}>Cancel</button>}
    </div>
    {busy && <p className="dm-settings__status" role="status">Request in progress: {busy}… Waiting for the agent’s result. This may take several minutes.</p>}
    {sessionState !== "idle" && <p className="dm-settings__hint">Finish or dismiss the current wiki review before starting another.</p>}
    {answer && <div className="dm-settings__field">
      <pre className="dm-settings__output">{answer.content}</pre>
      <button className="dm-settings__save-btn" disabled={disabled} onClick={() => run("query-save")}>Propose saving this answer</button>
    </div>}
    <WikiTaskFeedback error={errorMessage} report={report} rejected={rejected} reviewCount={reviewCount} />
  </section>;
}
