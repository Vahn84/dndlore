import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useAppStore } from "../store/appStore";
import Api from "../Api";
import "../styles/DmSettings.scss";

interface Settings {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  model: string;
  discordForumChannelId: string;
}

const DEFAULT_SETTINGS: Settings = {
  systemPrompt: "",
  temperature: 0.5,
  maxTokens: 64000,
  model: "",
  discordForumChannelId: "",
};

const DmSettings: React.FC = () => {
  const isDM = useAppStore((s) => s.isDM());
  const navigate = useNavigate();

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forumChannels, setForumChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  useEffect(() => {
    if (!isDM) {
      navigate("/");
      return;
    }
    Api.getSettings()
      .then((data) => {
        setSettings({
          systemPrompt: data.systemPrompt ?? "",
          temperature: data.temperature ?? 0.5,
          maxTokens: data.maxTokens ?? 64000,
          model: data.model ?? "",
          discordForumChannelId: data.discordForumChannelId ?? "",
        });
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));

    setLoadingChannels(true);
    Api.getDiscordForumChannels()
      .then(setForumChannels)
      .catch(() => {/* Discord not configured — silently ignore */})
      .finally(() => setLoadingChannels(false));
  }, [isDM, navigate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.updateSettings(settings);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
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
          {/* Summarization */}
          <div className="dm-settings__card">
            <h2 className="dm-settings__card-title">Session Summarization</h2>

            <div className="dm-settings__field">
              <label className="dm-settings__label">System Prompt</label>
              <textarea
                className="dm-settings__textarea"
                rows={8}
                value={settings.systemPrompt}
                onChange={(e) => set("systemPrompt", e.target.value)}
              />
              <span className="dm-settings__hint">
                Instructions for the LLM when generating narrative summaries from session notes.
              </span>
            </div>

            <div className="dm-settings__field">
              <label className="dm-settings__label">Temperature</label>
              <div className="dm-settings__range-row">
                <input
                  type="range"
                  className="dm-settings__range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.temperature}
                  onChange={(e) => set("temperature", parseFloat(e.target.value))}
                />
                <span className="dm-settings__range-value">{settings.temperature.toFixed(2)}</span>
              </div>
              <span className="dm-settings__hint">Lower = more focused, higher = more creative.</span>
            </div>

            <div className="dm-settings__field">
              <label className="dm-settings__label">Max Tokens</label>
              <input
                type="number"
                className="dm-settings__input"
                min={1024}
                max={128000}
                step={1024}
                value={settings.maxTokens}
                onChange={(e) => set("maxTokens", parseInt(e.target.value, 10))}
              />
            </div>

            <div className="dm-settings__field">
              <label className="dm-settings__label">Model</label>
              <input
                type="text"
                className="dm-settings__input"
                placeholder="Leave empty to use server default (LLM_MODEL)"
                value={settings.model}
                onChange={(e) => set("model", e.target.value)}
              />
            </div>

          </div>

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
              disabled={saving}
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
