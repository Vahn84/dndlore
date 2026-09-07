import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useAppStore } from "../store/appStore";
import Api from "../Api";
import WikiMaintenance from "../components/WikiMaintenance";
import "../styles/DmSettings.scss";

interface Settings {
  systemPrompt: string;
  discordForumChannelId: string;
}

const DEFAULT_SETTINGS: Settings = {
  systemPrompt: "",
  discordForumChannelId: "",
};

const DmSettings: React.FC = () => {
  const isDM = useAppStore((s) => s.isDM());
  const navigate = useNavigate();

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState<{ provider: "codex" | "claude"; model: string; effort: string }>({ provider: "codex", model: "", effort: "" });
  const [providers, setProviders] = useState<Awaited<ReturnType<typeof Api.getAgentSettings>>["providers"]>([]);
  const [agentError, setAgentError] = useState("");
  const [loadingAgent, setLoadingAgent] = useState(true);
  const loadAgent = () => {
    setLoadingAgent(true);
    setAgentError("");
    Api.getAgentSettings().then(data => {
      setProviders(data.providers);
      setAgent({ ...data.selection, effort: data.selection.effort ?? "" });
    }).catch(error => setAgentError(error?.response?.data?.error || "Agent settings are unavailable."))
      .finally(() => setLoadingAgent(false));
  };
  const [forumChannels, setForumChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const selectedModel = providers.find(p => p.id === agent.provider)?.models.find(m => m.id === agent.model);
  const efforts = selectedModel?.efforts ?? [{ id: "", label: "Provider default" }];
  const validSelection = !!selectedModel && efforts.some(e => e.id === agent.effort);

  useEffect(() => {
    if (!isDM) {
      navigate("/");
      return;
    }
    Api.getSettings()
      .then((data) => {
        setSettings({
          systemPrompt: data.systemPrompt ?? "",
          discordForumChannelId: data.discordForumChannelId ?? "",
        });
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));

    loadAgent();

    setLoadingChannels(true);
    Api.getDiscordForumChannels()
      .then(setForumChannels)
      .catch(() => {/* Discord not configured — silently ignore */})
      .finally(() => setLoadingChannels(false));
  }, [isDM, navigate]);

  const handleSave = async () => {
    setSaving(true);
    let agentSaved = false;
    try {
      await Api.updateAgentSettings(agent);
      agentSaved = true;
      await Api.updateSettings(settings);
      toast.success("Settings saved");
    } catch (error: any) {
      toast.error(agentSaved ? "Agent selection saved, but narrative/Discord settings could not be saved. Please retry." : error?.response?.data?.error || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  if (!isDM) return null;

  return (
    <div className="dm-settings">
      <div className="dm-settings__header">
        <h1 className="dm-settings__title">DM Control Panel</h1>
        <p className="dm-settings__subtitle">Runtime settings — changes take effect immediately on the next operation</p>
      </div>

      {loading ? null : (
        <>
          <div className="dm-settings__card">
            <h2 className="dm-settings__card-title">Campaign AI</h2>
            <p className="dm-settings__hint">One agent for session recaps, wiki ingestion, and wiki questions.</p>
            {loadingAgent ? <p className="dm-settings__hint">Loading agents and models…</p> : agentError ? (
              <div role="alert">
                <p className="dm-settings__hint">{agentError}</p>
                <button type="button" className="dm-settings__save-btn" onClick={loadAgent}>Retry</button>
              </div>
            ) : <>
              <div className="dm-settings__field">
                <label className="dm-settings__label" htmlFor="agent-provider">Agent</label>
                <select id="agent-provider" className="dm-settings__select" value={agent.provider}
                  onChange={e => setAgent({ provider: e.target.value as "codex" | "claude", model: "", effort: "" })}>
                  {providers.map(provider => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                </select>
              </div>
              <div className="dm-settings__field">
                <label className="dm-settings__label" htmlFor="agent-model">Model</label>
                <select id="agent-model" className="dm-settings__select" value={agent.model}
                  onChange={e => setAgent(prev => ({ ...prev, model: e.target.value, effort: "" }))}>
                  {!providers.find(p => p.id === agent.provider)?.models.some(m => m.id === agent.model) &&
                    <option value={agent.model} disabled>{agent.model || "Unavailable model"} — choose another</option>}
                  {(providers.find(p => p.id === agent.provider)?.models || []).map(model =>
                    <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>
                <span className="dm-settings__hint">Models configured for the connected agent. Availability depends on its account.</span>
              </div>
              <div className="dm-settings__field">
                <label className="dm-settings__label" htmlFor="agent-effort">Reasoning Effort</label>
                <select id="agent-effort" className="dm-settings__select" value={agent.effort}
                  onChange={e => setAgent(prev => ({ ...prev, effort: e.target.value }))}>
                  {!efforts.some(e => e.id === agent.effort) &&
                    <option value={agent.effort} disabled>{agent.effort} — choose another</option>}
                  {efforts.map(effort => <option key={effort.id} value={effort.id}>{effort.label}</option>)}
                </select>
                <span className="dm-settings__hint">{efforts.length > 1
                  ? "Higher effort can take longer and use more tokens. Applies to recaps, ingestion, and wiki questions."
                  : "Only provider default is available for this model. Choose a named, supported model to adjust effort."}</span>
              </div>
            </>}
          </div>

          {/* Summarization */}
          <div className="dm-settings__card">
            <h2 className="dm-settings__card-title">Session Summarization</h2>

            <div className="dm-settings__field">
              <label className="dm-settings__label" htmlFor="recap-prompt">Narrative Instructions</label>
              <textarea
                id="recap-prompt"
                className="dm-settings__textarea"
                rows={8}
                value={settings.systemPrompt}
                onChange={(e) => set("systemPrompt", e.target.value)}
              />
              <span className="dm-settings__hint">
                Your style and narration rules for session recaps. Player and DM audience rules are applied alongside these instructions.
              </span>
            </div>

          </div>

          <WikiMaintenance />

          {/* Discord */}
          <div className="dm-settings__card">
            <h2 className="dm-settings__card-title">Discord Integration</h2>

            <div className="dm-settings__field">
              <label className="dm-settings__label">Forum Channel for Page Publishing</label>
              {loadingChannels ? (
                <p className="dm-settings__hint">Loading channels…</p>
              ) : forumChannels.length === 0 ? (
                <p className="dm-settings__hint">No forum channels found (check Discord bot configuration).</p>
              ) : (
                <select
                  className="dm-settings__select"
                  value={settings.discordForumChannelId}
                  onChange={(e) => set("discordForumChannelId", e.target.value)}
                >
                  <option value="">— Select a forum channel —</option>
                  {forumChannels.map((ch) => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              )}
              <span className="dm-settings__hint">
                Pages will be published as new posts in this Discord forum channel.
              </span>
            </div>
          </div>

          <div className="dm-settings__actions">
            <button
              className="dm-settings__save-btn"
              onClick={handleSave}
              disabled={saving || loadingAgent || !!agentError || !validSelection}
            >
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DmSettings;
