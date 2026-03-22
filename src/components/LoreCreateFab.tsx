import { BooksIcon } from "@phosphor-icons/react/dist/csr/Books";
import { GlobeHemisphereWestIcon } from "@phosphor-icons/react/dist/csr/GlobeHemisphereWest";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { CloudArrowDownIcon } from "@phosphor-icons/react/dist/csr/CloudArrowDown";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { DiscordLogoIcon } from "@phosphor-icons/react/dist/csr/DiscordLogo";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Api from "../Api";
import { toast } from "react-hot-toast";
import { useAppStore } from "../store/appStore";
import DatePicker from "./DatePicker";
import AssetsManagerModal from "./AssetsManagerModal";
import DiscordEventModal from "./DiscordEventModal";
import SyncFromGoogleDocsModal from "./modals/SyncFromGoogleDocsModal";
import SessionPreviewModal from "./modals/SessionPreviewModal";
import KnowledgeBaseExportModal from "./KnowledgeBaseExportModal";

type LoreType = "history" | "campaign" | "people" | "myth";

const LoreCreateFab: React.FC = () => {
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
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({
    total: 0,
    uploaded: 0,
    failed: 0,
    updated: 0,
  });

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

  const handleExportToKnowledge = async () => {
    const { type } = useParams();
    const currentType = type || "campaign";

    setExportModalOpen(true);
    setOpen(false);
    setExporting(true);
    setExportProgress({ total: 0, uploaded: 0, failed: 0, updated: 0 });

    try {
      const pages = await Api.getPages(currentType);
      setExportProgress((prev) => ({ ...prev, total: pages.length }));

      const result = await Api.exportToKnowledge(
        "individual",
        undefined,
        [currentType]
      );

      const uploadedArray = result.uploaded || [];
      const updatedCount = uploadedArray.filter(
        (p: any) => p.action === "update"
      ).length;

      const failedCount = result.failed || 0;

      setExportProgress({
        total: result.total,
        uploaded: uploadedArray.length,
        failed: result.failed,
        updated: updatedCount,
      });

      if (result.failed > 0) {
        toast.error(`Exported ${uploadedArray.length} pages, ${result.failed} failed`);
      } else {
        toast.success(`Successfully exported ${uploadedArray.length} pages`);
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed");
    } finally {
      setExporting(false);
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
                      handleExportToKnowledge();
                      setOpen(false);
                    }}
                    title="Export current type pages to Knowledge Base"
                  >
                    <CloudArrowDownIcon
                      size={22}
                      className="lcfab__content_wrapper--option-icon"
                    />
                    Export to KB
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

      <KnowledgeBaseExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        exporting={exporting}
        progress={exportProgress}
      />
    </>
  );
};

export default LoreCreateFab;
