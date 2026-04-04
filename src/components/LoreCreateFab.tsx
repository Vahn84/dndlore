import { BooksIcon } from "@phosphor-icons/react/dist/csr/Books";
import { GlobeHemisphereWestIcon } from "@phosphor-icons/react/dist/csr/GlobeHemisphereWest";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { CloudArrowDownIcon } from "@phosphor-icons/react/dist/csr/CloudArrowDown";
import { ShareNetworkIcon } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { DiscordLogoIcon } from "@phosphor-icons/react/dist/csr/DiscordLogo";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Api from "../Api";
import { toast } from "react-hot-toast";
import { useAppStore } from "../store/appStore";
import DatePicker from "./DatePicker";
import AssetsManagerModal from "./AssetsManagerModal";
import DiscordEventModal from "./DiscordEventModal";
import SyncFromGoogleDocsModal from "./modals/SyncFromGoogleDocsModal";
import SessionPreviewModal from "./modals/SessionPreviewModal";

type LoreType = "history" | "campaign" | "people" | "myth";

interface LoreCreateFabProps {
  currentType?: string;
  onPageCreated?: () => void;
}

const LoreCreateFab: React.FC<LoreCreateFabProps> = ({ currentType = "campaign", onPageCreated }) => {
  const [open, setOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [discordEventOpen, setDiscordEventOpen] = useState(false);
  const [docInput, setDocInput] = useState<string>(
    () =>
      localStorage.getItem("drive_doc_input") ||
      process.env.REACT_APP_GOOGLE_DOC_URL ||
      "",
  );
  const [summarize, setSummarize] = useState<boolean>(true);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // Available dates from backend (Step 1)
  const [availableDates, setAvailableDates] = useState<
    Array<{ date: string; content: string }>
  >([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Preview data from backend (Step 2)
  const [previewData, setPreviewData] = useState<any>(null);

  // Modal step: 1 = select date, 2 = preview summary
  const [previewStep, setPreviewStep] = useState<number>(1);

  // Editable fields for the preview modal
  const [titleInput, setTitleInput] = useState<string>("");
  const [subtitleInput, setSubtitleInput] = useState<string>("");
  const [worldDate, setWorldDate] = useState<any>(null);
  const [bannerUrl, setBannerUrl] = useState<string>("");
  const [assetOpen, setAssetOpen] = useState<boolean>(false);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const isDM = useAppStore((s) => s.isDM());
  const user = useAppStore((s) => s.user);
  const timeSystem = useAppStore((s) => s.data.timeSystem.data);
  const loadTimeSystem = useAppStore((s) => s.loadTimeSystem);

  // Close panel with Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Close sync modal with Escape
  useEffect(() => {
    if (!syncOpen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setSyncOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [syncOpen]);

  // Close preview modal with Escape
  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setPreviewOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  // Load time system when preview modal opens
  useEffect(() => {
    if (previewOpen && !timeSystem) {
      void loadTimeSystem();
    }
  }, [previewOpen, timeSystem, loadTimeSystem]);

  // Close when clicking/tapping outside the surface
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const el = surfaceRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && !el.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, {
      passive: true,
    });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleCreate = (type: string) => navigate(`/lore/${type}/new`);

  const extractDocId = (input: string): string | null => {
    if (!input) return null;
    const trimmed = input.trim();
    // If it's already an id-like string
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
    // Try to parse from a Google Docs URL
    const m = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  };

  // handleSyncFromDrive function moved to SyncFromGoogleDocsModal component

  // handleSummarizeDate function moved to SessionPreviewModal component

  // handleCreateFromPreview function moved to SessionPreviewModal component

  const handleBatchSyncToLightRag = async () => {
    const toastId = toast.loading(`Queuing ${currentType} pages for LightRAG…`);
    try {
      const result = await Api.batchSyncToLightRag(currentType);
      toast.dismiss(toastId);
      if (result.total === 0) {
        toast("All pages already synced", { icon: "✓" });
        return;
      }
      useAppStore.getState().triggerLightRagSync();
      if (result.failed > 0) {
        toast.error(`Sent ${result.synced}/${result.total} — ${result.failed} failed`);
      } else {
        toast.success(`${result.synced} pages queued for processing`);
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("LightRAG batch sync failed");
    }
  };

  const onSurfaceKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (!open && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      <div className="lore-create-fab" aria-live="polite">
        <div
          className="lcfab__surface"
          data-open={open}
          ref={surfaceRef}
          role={!open ? "button" : undefined}
          tabIndex={!open ? 0 : -1}
          aria-expanded={open}
          aria-controls="lcfab-panel"
          onClick={!open ? () => setOpen(true) : undefined}
          onKeyDown={onSurfaceKeyDown}
        >
          {/* Closed state: plus icon */}
          <span className="lcfab__plus" aria-hidden>
            <i className="icon icli iconly-Plus"></i>
          </span>

          {/* Open state content (fades/slides in) */}
          <div id="lcfab-panel" className="lcfab__content" aria-hidden={!open}>
            <div className="lcfab__content_wrapper">
              <div
                className="lcfab__content_wrapper--option history-option"
                onClick={() => handleCreate("history")}
              >
                <BooksIcon
                  size={18}
                  className="lcfab__content_wrapper--option-icon"
                />
                History
              </div>
              <div
                className="lcfab__content_wrapper--option campaign-option"
                onClick={() => handleCreate("campaign")}
              >
                <GlobeHemisphereWestIcon
                  size={18}
                  className="lcfab__content_wrapper--option-icon"
                />
                Campaign
              </div>
              <div
                className="lcfab__content_wrapper--option myth-option"
                onClick={() => handleCreate("myth")}
              >
                <SparkleIcon
                  size={18}
                  className="lcfab__content_wrapper--option-icon"
                />
                Myths
              </div>
              <div
                className="lcfab__content_wrapper--option people-option"
                onClick={() => handleCreate("people")}
              >
                <UsersThreeIcon
                  size={18}
                  className="lcfab__content_wrapper--option-icon"
                />
                Organizations
              </div>

              {isDM && (
                <>
                  <div
                    className="lcfab__content_wrapper--option sync-option"
                    onClick={() => {
                      setSyncOpen(true);
                      setOpen(false);
                    }}
                    title="Import latest session notes from Google Doc and create a draft"
                  >
                    <CloudArrowDownIcon
                      size={22}
                      className="lcfab__content_wrapper--option-icon"
                    />
                    Sync Session
                  </div>
                  <div
                    className="lcfab__content_wrapper--option export-kb-option"
                    onClick={() => {
                      setOpen(false);
                      handleBatchSyncToLightRag();
                    }}
                    title="Sync all unsynced pages of this type to LightRAG"
                  >
                    <ShareNetworkIcon
                      size={22}
                      className="lcfab__content_wrapper--option-icon"
                    />
                    Sync to KB
                  </div>
                  <div
                    className="lcfab__content_wrapper--option discord-option"
                    onClick={() => {
                      setDiscordEventOpen(true);
                      setOpen(false);
                    }}
                    title="Create a Discord event with Apollo bot"
                  >
                    <DiscordLogoIcon
                      size={22}
                      className="lcfab__content_wrapper--option-icon"
                    />
                    Discord Event
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <SyncFromGoogleDocsModal
        isOpen={syncOpen}
        onClose={() => setSyncOpen(false)}
        docInput={docInput}
        setDocInput={setDocInput}
        summarize={summarize}
        setSummarize={setSummarize}
        isLoadingPreview={isLoadingPreview}
        setIsLoadingPreview={setIsLoadingPreview}
        availableDates={availableDates}
        setAvailableDates={setAvailableDates}
        setSelectedDate={setSelectedDate}
        setPreviewStep={(value: number) => setPreviewStep(value)}
        setPreviewData={setPreviewData}
        setTitleInput={setTitleInput}
        setSubtitleInput={setSubtitleInput}
        setWorldDate={setWorldDate}
        setBannerUrl={setBannerUrl}
        setPreviewOpen={setPreviewOpen}
      />

      <SessionPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onPageCreated={onPageCreated}
        previewStep={previewStep}
        setPreviewStep={(value: number) => setPreviewStep(value)}
        availableDates={availableDates}
        setAvailableDates={setAvailableDates}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        isDropdownOpen={isDropdownOpen}
        setIsDropdownOpen={setIsDropdownOpen}
        previewData={previewData}
        setPreviewData={setPreviewData}
        titleInput={titleInput}
        setTitleInput={setTitleInput}
        subtitleInput={subtitleInput}
        setSubtitleInput={setSubtitleInput}
        worldDate={worldDate}
        setWorldDate={setWorldDate}
        bannerUrl={bannerUrl}
        setBannerUrl={setBannerUrl}
        assetOpen={assetOpen}
        setAssetOpen={setAssetOpen}
        isLoadingSummary={isLoadingSummary}
        setIsLoadingSummary={setIsLoadingSummary}
      />

      <DiscordEventModal
        isOpen={discordEventOpen}
        onClose={() => setDiscordEventOpen(false)}
      />

    </>
  );
};

export default LoreCreateFab;
