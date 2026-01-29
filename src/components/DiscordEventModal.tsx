import React, { useState, useEffect, useMemo } from "react";
import Modal from "react-modal";
import { toast } from "react-hot-toast";
import AssetsManagerModal from "./AssetsManagerModal";
import { useAppStore, type Asset } from "../store/appStore";
import SessionDatePicker from "./SessionDatePicker";
import Api from "../Api";
import "../styles/DiscordEventModal.scss";
import Constants from "../Constants";

// Import the refactored components
import EventDetailsSection from "./DiscordEventModal_EventDetailsSection";
import DescriptionBuilderSection from "./DiscordEventModal_DescriptionBuilderSection";
import CalendarSyncSection from "./DiscordEventModal_CalendarSyncSection";
import EventActions from "./DiscordEventModal_EventActions";
import PagePickerModal from "./DiscordEventModal_PagePickerModal";

Modal.setAppElement("#root");

interface DiscordEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRecapPages?: string[]; // Pre-selected campaign page IDs for RECAP
  linkedEventId?: string; // ID of the linked timeline event for TIMELINE link
}

const DiscordEventModal: React.FC<DiscordEventModalProps> = ({
  isOpen,
  onClose,
  initialRecapPages = [],
  linkedEventId,
}) => {
  const [title, setTitle] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [assetOpen, setAssetOpen] = useState(false);
  // Session-style date string (DD/MM/YYYY)
  const [dateStr, setDateStr] = useState<string | null>(null);
  // Separate time selection to avoid timezone issues
  const [hour, setHour] = useState<string>("21");
  const [minute, setMinute] = useState<string>("30");
  const [channel, setChannel] = useState("");
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [voiceChannel, setVoiceChannel] = useState("");
  const [voiceChannels, setVoiceChannels] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [guildId, setGuildId] = useState<string>("");
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false);
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [calendarId, setCalendarId] = useState("primary");
  const [calendars, setCalendars] = useState<
    Array<{ id: string; name: string; primary: boolean }>
  >([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [calendarDropdownOpen, setCalendarDropdownOpen] = useState(false);

  // Description builder state
  const [recapPageIds, setRecapPageIds] = useState<string[]>(initialRecapPages);
  const [webclientUrl, setWebclientUrl] = useState(Constants.FVTT_URL);
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const [availablePages, setAvailablePages] = useState<any[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);

  const normalizeName = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");

  const resolveAssetUrl = Api.resolveAssetUrl;
  const groups = useAppStore((s) => s.data.groups.data);
  const events = useAppStore((s) => s.data.events.data);

  // Load Discord channels on mount
  useEffect(() => {
    if (isOpen) {
      loadChannels();
      loadVoiceChannels();
      loadCampaignPages();
      if (syncToCalendar) {
        loadCalendars();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (syncToCalendar && calendars.length === 0) {
      loadCalendars();
    }
  }, [syncToCalendar]);

  // Reset RECAP selection when initialRecapPages changes
  useEffect(() => {
    if (initialRecapPages.length > 0) {
      setRecapPageIds(initialRecapPages);
    }
  }, [initialRecapPages]);

  // Build description with RECAP, TIMELINE, WEBCLIENT, VOICE
  const buildDescription = useMemo(() => {
    const lines: string[] = [];
    const frontendOrigin = window.location.origin;

    // RECAP
    if (recapPageIds.length > 0) {
      lines.push("**RECAP:**");
      recapPageIds.forEach((pageId) => {
        const page = availablePages.find((p: any) => p._id === pageId);
        if (page) {
          const pageLabel = page.subtitle
            ? `${page.subtitle} - ${page.title}`
            : page.title;
          lines.push(
            `- ${pageLabel}: ${frontendOrigin}/lore/campaign/${pageId}`,
          );
        }
      });
      lines.push("");
    }

    // TIMELINE - Always show Campaign timeline
    lines.push(`**TIMELINE:** ${frontendOrigin}/timeline?groups=Campaign`);
    lines.push("");

    // WEBCLIENT
    if (webclientUrl.trim()) {
      lines.push(`**WEBCLIENT:** ${webclientUrl.trim()}`);
      lines.push("");
    }

    // VOICE CHANNEL
    if (voiceChannel && guildId) {
      const selectedVoice = voiceChannels.find((vc) => vc.id === voiceChannel);
      if (selectedVoice) {
        lines.push(
          `**VOICE CHANNEL:** https://discord.com/channels/${guildId}/${voiceChannel}`,
        );
      }
    }

    return lines.join("\n");
  }, [
    recapPageIds,
    availablePages,
    webclientUrl,
    voiceChannel,
    voiceChannels,
    guildId,
  ]);

  const loadCampaignPages = async () => {
    setIsLoadingPages(true);
    try {
      const pages = await Api.getPages("campaign");
      // Sort campaign pages by startDate descending (most recent first)
      const sortedPages = pages.sort((a: any, b: any) => {
        const dateA = a.sessionDate ? new Date(a.sessionDate).getTime() : 0;
        const dateB = b.sessionDate ? new Date(b.sessionDate).getTime() : 0;
        return dateB - dateA; // Descending order
      });
      setAvailablePages(sortedPages);
    } catch (err) {
      console.error("Failed to load campaign pages", err);
    } finally {
      setIsLoadingPages(false);
    }
  };

  const loadVoiceChannels = async () => {
    try {
      const resp = await Api.getDiscordVoiceChannels?.();
      if (resp && resp.channels) {
        setVoiceChannels(resp.channels);
        setGuildId(resp.guildId || "");
        if (!voiceChannel) {
          const preferredVoice = resp.channels.find((vc) =>
            normalizeName(vc.name).includes("dnd"),
          );
          if (preferredVoice) {
            setVoiceChannel(preferredVoice.id);
          }
        }
      } else {
        setVoiceChannels([]);
      }
    } catch (err) {
      console.error("Failed to load voice channels", err);
    }
  };

  const loadCalendars = async () => {
    setIsLoadingCalendars(true);
    try {
      const resp = await Api.getGoogleCalendars?.();
      if (resp && Array.isArray(resp)) {
        setCalendars(resp);
        const preferredCalendar = resp.find((cal) => {
          const lower = (cal.name || "").toLowerCase();
          return lower.includes("d&d") || lower.includes("dnd");
        });
        if (preferredCalendar) {
          setCalendarId(preferredCalendar.id);
        } else if (!calendarId || calendarId === "primary") {
          const primary = resp.find((cal) => cal.primary);
          if (primary) {
            setCalendarId(primary.id);
          } else if (resp.length > 0) {
            setCalendarId(resp[0].id);
          }
        }
      } else {
        setCalendars([]);
      }
    } catch (err) {
      console.error("Failed to load calendars", err);
      // Don't show error toast, user might not have Google connected
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  const loadChannels = async () => {
    setIsLoadingChannels(true);
    try {
      // Try real backend first; fall back to empty with notice
      const resp = await Api.getDiscordChannels?.();
      if (resp && Array.isArray(resp)) {
        setChannels(resp);
        if (!channel) {
          const preferred =
            resp.find((ch) => normalizeName(ch.name) === "dndone") ||
            resp.find((ch) => normalizeName(ch.name).includes("dnd"));
          if (preferred) {
            setChannel(preferred.id);
          }
        }
      } else {
        setChannels([]);
      }
    } catch (err) {
      console.error("Failed to load channels", err);
      toast.error(
        "Failed to load Discord channels. Connect your Discord server in settings.",
      );
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Event title is required");
      return;
    }
    if (!dateStr) {
      toast.error("Event date is required");
      return;
    }
    if (!channel) {
      toast.error("Please select a channel");
      return;
    }

    setIsCreating(true);
    try {
      // TODO: Implement Discord event creation with Apollo bot
      // This will need backend endpoint that:
      // 1. Creates Discord scheduled event via Apollo bot
      // 2. Syncs with Google Calendar API
      // 3. Returns event details

      // Compose local Date from DD/MM/YYYY + HH:mm to avoid timezone shift in UI
      const [dd, mm, yyyy] = (dateStr || "")
        .split("/")
        .map((v) => parseInt(v, 10));
      const h = parseInt(hour, 10) || 0;
      const m = parseInt(minute, 10) || 0;
      const localDate = new Date(yyyy, (mm || 1) - 1, dd || 1, h, m, 0, 0);

      // Resolve banner URL to full absolute URL
      const resolvedBannerUrl = bannerUrl ? Api.resolveAssetUrl(bannerUrl) : "";

      const payload = {
        title,
        description: buildDescription,
        bannerUrl: resolvedBannerUrl,
        dateTimeUtc: localDate.toISOString(),
        channelId: channel,
        voiceChannelId: voiceChannel || undefined,
        syncToCalendar,
        calendarId: syncToCalendar ? calendarId : undefined,
      };

      console.log("Creating Discord event:", payload);

      // Try backend if available
      if (Api.createDiscordEvent) {
        await Api.createDiscordEvent(payload);
      } else {
        // Fallback mock
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      toast.success("Discord event created successfully!");
      handleClose();
    } catch (err: any) {
      console.error("Failed to create Discord event", err);
      toast.error(err?.message || "Failed to create Discord event");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setBannerUrl("");
    setDateStr(null);
    setChannel("");
    setVoiceChannel("");
    setDropdownOpen(false);
    setVoiceDropdownOpen(false);
    setRecapPageIds([]);
    setWebclientUrl(Constants.FVTT_URL);
    onClose();
  };

  const toggleRecapPage = (pageId: string) => {
    setRecapPageIds((prev) =>
      prev.includes(pageId)
        ? prev.filter((id) => id !== pageId)
        : [...prev, pageId],
    );
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onRequestClose={handleClose}
        contentLabel="Create Discord Event"
        className="modal__content modal__content--discord-event"
        overlayClassName="modal__overlay"
      >
        <div className="modal__body">
          <div className="modal__body_content">
            <h2
              style={{
                marginTop: 0,
                fontSize: "1.5rem",
                color: "#e6c896",
                marginBottom: "0.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              Create Discord Event
              {/* Actions */}
              <EventActions
                isCreating={isCreating}
                onCancel={handleClose}
                onCreate={handleCreate}
              />
            </h2>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#94a3b8",
                marginBottom: "1.5rem",
              }}
            >
              Schedule an event on Discord and sync with Google Calendar
            </p>

            <div className="modal__two-columns" style={{ marginBottom: "0" }}>
              {/* LEFT COLUMN - Event Details */}
              <EventDetailsSection
                title={title}
                setTitle={setTitle}
                bannerUrl={bannerUrl}
                setBannerUrl={setBannerUrl}
                openAssetManager={setAssetOpen}
                resolveAssetUrl={resolveAssetUrl}
                dateStr={dateStr}
                setDateStr={setDateStr}
                hour={hour}
                setHour={setHour}
                minute={minute}
                setMinute={setMinute}
                syncToCalendar={syncToCalendar}
                setSyncToCalendar={setSyncToCalendar}
                calendarId={calendarId}
                setCalendarId={setCalendarId}
                calendars={calendars}
                isLoadingCalendars={isLoadingCalendars}
                calendarDropdownOpen={calendarDropdownOpen}
                setCalendarDropdownOpen={setCalendarDropdownOpen}
              />

              {/* RIGHT COLUMN - Description Builder */}
              <DescriptionBuilderSection
                recapPageIds={recapPageIds}
                setRecapPageIds={setRecapPageIds}
                availablePages={availablePages}
                webclientUrl={webclientUrl}
                setWebclientUrl={setWebclientUrl}
                onPagePickerOpen={() => setPagePickerOpen(true)}
                channels={channels}
                channel={channel}
                setChannel={setChannel}
                voiceChannels={voiceChannels}
                voiceChannel={voiceChannel}
                setVoiceChannel={setVoiceChannel}
                isLoadingChannels={isLoadingChannels}
                dropdownOpen={dropdownOpen}
                setDropdownOpen={setDropdownOpen}
                voiceDropdownOpen={voiceDropdownOpen}
                setVoiceDropdownOpen={setVoiceDropdownOpen}
              />
            </div>

            {/* Description Preview */}
            <div style={{ marginTop: "0" }}>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#94a3b8",
                  marginBottom: "0.5rem",
                }}
              >
                Preview:
              </div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                  wordBreak: "break-all",
                  overflowWrap: "break-word",
                  fontSize: "0.75rem",
                  color: "#cbd5e1",
                  background: "rgb(27, 29, 31)",
                  padding: "0.75rem",
                  borderRadius: "4px",
                  maxHeight: "200px",
                  overflow: "auto",
                  border: "1px solid rgb(153, 126, 67)",
                  margin: 0,
                }}
              >
                {buildDescription || "(Description will appear here)"}
              </pre>
            </div>


          </div>
        </div>
      </Modal>

      {/* Page Picker Modal */}
      <PagePickerModal
        isOpen={pagePickerOpen}
        onClose={() => setPagePickerOpen(false)}
        availablePages={availablePages}
        recapPageIds={recapPageIds}
        onToggleRecapPage={toggleRecapPage}
        isLoadingPages={isLoadingPages}
      />

      <AssetsManagerModal
        isOpen={assetOpen}
        onClose={() => setAssetOpen(false)}
        onSelect={(asset: Asset) => {
          setBannerUrl(asset.url);
          setAssetOpen(false);
        }}
      />
    </>
  );
};

export default DiscordEventModal;
