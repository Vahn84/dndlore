import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useAppStore } from "../store/appStore";
import { wikiTask } from "../utils/wikiTask";

export default function WikiMaintenance() {
  const [question, setQuestion] = useState("");
  const [spoilers, setSpoilers] = useState(false);
  const [answer, setAnswer] = useState<{ content: string; query_id: string }>();
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState("");
  const controller = useRef<AbortController | null>(null);
  const sessionState = useAppStore(s => s.ingestSession.state);
  useEffect(() => () => controller.current?.abort(), []);
  const run = async (operation: "query" | "lint" | "query-save" | "reindex") => {
    if (busy) return;
    setBusy(operation);
    const ac = new AbortController(); controller.current = ac;
    try {
      const data = await wikiTask<any>(operation, { question, include_spoilers: spoilers, query_id: answer?.query_id }, ac.signal);
      if (operation === "query") setAnswer(data);
      else if (operation === "reindex") toast.success(`Index updated: ${data.pages} pages`);
      else {
        setReport(data.report);
        if (data.proposals?.length) {
          const store = useAppStore.getState();
          if (store.ingestSession.state !== "idle") throw new Error("An ingestion started while this task was running. Finish it, then rerun this review.");
          store.resetIngest();
          store.setIngestState({ state: "ready", plan: data.plan, proposals: data.proposals, panelOpen: true });
        }
      }
    } catch (error: any) { if (!ac.signal.aborted) toast.error(error.message || "Wiki operation failed"); }
    finally { setBusy(""); controller.current = null; }
  };
  const disabled = !!busy || sessionState !== "idle";
  return <section className="dm-settings__card">
    <h2 className="dm-settings__card-title">Wiki knowledge & maintenance</h2>
    <p className="dm-settings__hint">Uses the saved agent selection. Answers can become cited wiki pages after review; lint proposes repairs. The agent maintains the index automatically after approved changes.</p>
    <div className="dm-settings__field">
      <label className="dm-settings__label" htmlFor="wiki-question">Ask the wiki</label>
      <textarea id="wiki-question" className="dm-settings__textarea" rows={3} value={question} onChange={e => setQuestion(e.target.value)} />
      <label><input type="checkbox" checked={spoilers} onChange={e => setSpoilers(e.target.checked)} /> Include DM secrets</label>
    </div>
    <div className="dm-settings__actions" style={{ flexWrap: "wrap", gap: 12 }}>
      <button className="dm-settings__save-btn" disabled={disabled || !question.trim()} onClick={() => run("query")}>Ask</button>
      <button className="dm-settings__save-btn" disabled={disabled} onClick={() => run("lint")}>Lint wiki</button>
      <button className="dm-settings__save-btn" disabled={!!busy} onClick={() => run("reindex")}>Repair index</button>
      {busy && <button className="dm-settings__save-btn" onClick={() => controller.current?.abort()}>Cancel</button>}
    </div>
    {busy && <p role="status">Agent working: {busy}… This may take several minutes.</p>}
    {sessionState !== "idle" && <p className="dm-settings__hint">Finish or dismiss the current wiki review before starting another.</p>}
    {answer && <div className="dm-settings__field">
      <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit" }}>{answer.content}</pre>
      <button className="dm-settings__save-btn" disabled={disabled} onClick={() => run("query-save")}>Propose saving this answer</button>
    </div>}
    {report && <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit" }}>{report}</pre>}
  </section>;
}
