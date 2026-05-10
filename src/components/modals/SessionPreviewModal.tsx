import React, { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Api from '../../Api';
import { useAppStore } from '../../store/appStore';
import DatePicker from '../DatePicker';
import AssetsManagerModal from '../AssetsManagerModal';
import { TrashIcon } from '@phosphor-icons/react/dist/icons/Trash';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Bold from '@tiptap/extension-bold';
import Underline from '@tiptap/extension-underline';
import '../../styles/RichTextEditor.scss';

/** Minimal TipTap editor for the summary preview — mounts only when content is ready */
const SummaryRichEditor: React.FC<{
  content: any;
  onChange: (json: any) => void;
}> = ({ content, onChange }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ code: false, codeBlock: false }),
      Bold,
      Underline,
    ],
    content,
    editable: true,
    editorProps: {
      attributes: { class: 'rt-content' },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  if (!editor) return null;
  return <EditorContent editor={editor} />;
};

interface SessionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPageCreated?: () => void;
  previewStep: number;
  setPreviewStep: (value: number) => void;
  availableDates: Array<{ date: string; content: string }>;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (value: boolean) => void;
  previewData: any;
  setPreviewData: (value: any) => void;
  titleInput: string;
  setTitleInput: (value: string) => void;
  subtitleInput: string;
  setSubtitleInput: (value: string) => void;
  worldDate: any;
  setWorldDate: (value: any) => void;
  bannerUrl: string;
  setBannerUrl: (value: string) => void;
  assetOpen: boolean;
  setAssetOpen: (value: boolean) => void;
  isLoadingSummary: boolean;
  setAvailableDates: (value: Array<{ date: string; content: string }>) => void;
  setIsLoadingSummary: (value: boolean) => void;
}

const SessionPreviewModal: React.FC<SessionPreviewModalProps> = ({
  isOpen,
  onClose,
  onPageCreated,
  previewStep,
  setPreviewStep,
  availableDates,
  setAvailableDates,
  selectedDate,
  setSelectedDate,
  isDropdownOpen,
  setIsDropdownOpen,
  previewData,
  setPreviewData,
  titleInput,
  setTitleInput,
  subtitleInput,
  setSubtitleInput,
  worldDate,
  setWorldDate,
  bannerUrl,
  setBannerUrl,
  assetOpen,
  setAssetOpen,
  isLoadingSummary,
  setIsLoadingSummary,
}) => {
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const isDM = useAppStore((s) => s.isDM());
  const user = useAppStore((s) => s.user);
  const timeSystem = useAppStore((s) => s.data.timeSystem.data);
  const loadTimeSystem = useAppStore((s) => s.loadTimeSystem);

  // Track the edited TipTap JSON for the summary (starts from summaryRich, mutated by DM edits)
  const [editedSummaryRich, setEditedSummaryRich] = React.useState<any>(null);

  // Audience picker — affects which AppSettings prompt + temperature the
  // backend uses, and whether wiki-server includes spoiler-tagged pages.
  // 'player' (default): public-facing recap, spoilers excluded.
  // 'dm':              structured analysis, full lore access.
  const [audience, setAudience] = React.useState<'player' | 'dm'>('player');

  useEffect(() => {
    if (previewData?.summaryRich) setEditedSummaryRich(previewData.summaryRich);
  }, [previewData?.summaryRich]);

  // Load time system when modal opens
  useEffect(() => {
    if (isOpen && !timeSystem) {
      void loadTimeSystem();
    }
  }, [isOpen, timeSystem, loadTimeSystem]);

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
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleSummarizeDate = async () => {
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }

    const selectedSession = availableDates.find(
      (d) => d.date === selectedDate
    );
    if (!selectedSession) {
      toast.error('Selected date not found');
      return;
    }

    setIsLoadingSummary(true);

    try {
      const tId = toast.loading('Summarizing with AI…', {
        id: 'summarize',
      });

      // Step 2: Call summarize endpoint
      const resp = await fetch(
        `${Api.getBaseUrl()}/sync/campaign/summarize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({
            rawText: selectedSession.content,
            sessionDate: selectedDate,
            audience,
          }),
        }
      );
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data?.error || 'Summarization failed');
      }

      // Success - move to step 2 with summary
      toast.success('Summary ready', { id: tId });
      setPreviewData({
        summary: data.summary,
        summaryRich: data.summaryRich,
        sessionDate: selectedDate,
        suggestedTitle:
          data.suggestedTitle || `Session ${selectedDate}`,
        rawText: selectedSession.content,
      });
      setTitleInput(data.suggestedTitle || `Session ${selectedDate}`);
      setPreviewStep(2);
    } catch (e: any) {
      toast.error(e?.message || 'Summarization failed');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleCreateFromPreview = async () => {
    if (!previewData) return;

    try {
      const tId = toast.loading('Creating page…', { id: 'create-page' });

      const resp = await fetch(
        `${Api.getBaseUrl()}/sync/campaign/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({
            summary: previewData.summary,
            summaryRich: editedSummaryRich ?? previewData.summaryRich,
            sessionDate: previewData.sessionDate,
            title: titleInput.trim() || previewData.suggestedTitle,
            subtitle: subtitleInput.trim(),
            worldDate,
            bannerUrl: bannerUrl.trim(),
          }),
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data?.error || 'Creation failed');
      }

      if (data?.created?._id) {
        toast.success('Draft page created', { id: tId });
        onPageCreated?.();
        onClose();
        // Reset state
        setTitleInput('');
        setSubtitleInput('');
        setWorldDate(null);
        setBannerUrl('');
        setPreviewData(null);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Creation failed');
    }
  };

  if (!isOpen || !isDM) return null;

  return (
    <div
      className="lcfab__modal"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="lcfab__modal__card lcfab__modal__card--large"
        role="document"
      >
        {previewStep === 1 ? (
          <>
            {/* STEP 1: Select Date and Preview Raw Content */}
            <div className="lcfab__modal__title">
              Select Session to Import
            </div>

            <label className="lcfab__modal__label">
              Available Sessions
            </label>
            <div
              className="lcfab__modal__dropdown"
              ref={dropdownRef}
            >
              <button
                type="button"
                className="lcfab__modal__dropdown-toggle"
                onClick={() =>
                  setIsDropdownOpen(!isDropdownOpen)
                }
              >
                <span>
                  {selectedDate || 'Select a session'}
                </span>
                <span className="lcfab__modal__dropdown-arrow">
                  {isDropdownOpen ? '▲' : '▼'}
                </span>
              </button>

              {isDropdownOpen && (
                <div className="lcfab__modal__dropdown-menu">
                  {availableDates.length === 0 ? (
                    <div className="lcfab__modal__dropdown-empty">
                      No sessions found
                    </div>
                  ) : (
                    availableDates.map(
                      (session) => (
                        <button
                          key={session.date}
                          type="button"
                          className={`lcfab__modal__dropdown-item ${
                            selectedDate ===
                            session.date
                              ? 'lcfab__modal__dropdown-item--selected'
                              : ''
                          }`}
                          onClick={() => {
                            setSelectedDate(
                              session.date
                            );
                            setIsDropdownOpen(
                              false
                            );
                          }}
                        >
                          {session.date}
                        </button>
                      )
                    )
                  )}
                </div>
              )}
            </div>

            <label className="lcfab__modal__label">
              Raw Notes Preview
            </label>
            <div
              className="lcfab__modal__preview"
              style={{
                maxHeight: '400px',
                overflowY: 'auto',
              }}
            >
              {availableDates.find(
                (d) => d.date === selectedDate
              )?.content || 'No content'}
            </div>

            <div
              className="lcfab__modal__field"
              style={{ marginTop: 12 }}
            >
              <label className="lcfab__modal__label">
                Audience
              </label>
              <div
                role="radiogroup"
                aria-label="Audience"
                style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border:
                      audience === 'player'
                        ? '1px solid var(--accent, #c9a96e)'
                        : '1px solid var(--muted-border, #444)',
                    background:
                      audience === 'player'
                        ? 'rgba(201,169,110,0.08)'
                        : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="audience"
                    value="player"
                    checked={audience === 'player'}
                    onChange={() => setAudience('player')}
                    disabled={isLoadingSummary}
                  />
                  <span>
                    <strong>Pubblico</strong>{' '}
                    <span style={{ opacity: 0.7, fontSize: '0.85em' }}>
                      — recap narrativo, spoiler esclusi
                    </span>
                  </span>
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border:
                      audience === 'dm'
                        ? '1px solid var(--accent, #c9a96e)'
                        : '1px solid var(--muted-border, #444)',
                    background:
                      audience === 'dm'
                        ? 'rgba(201,169,110,0.08)'
                        : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="audience"
                    value="dm"
                    checked={audience === 'dm'}
                    onChange={() => setAudience('dm')}
                    disabled={isLoadingSummary}
                  />
                  <span>
                    <strong>DM-prep</strong>{' '}
                    <span style={{ opacity: 0.7, fontSize: '0.85em' }}>
                      — analisi strutturata, lore completa
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="lcfab__modal__actions">
              <button
                className="modal__btn cancel"
                onClick={() => {
                  onClose();
                  setPreviewStep(1);
                  setAvailableDates([]);
                  setSelectedDate('');
                }}
              >
                Cancel
              </button>
              <button
                className="modal__btn primary"
                onClick={handleSummarizeDate}
                disabled={
                  isLoadingSummary || !selectedDate
                }
              >
                {isLoadingSummary
                  ? 'Summarizing…'
                  : audience === 'dm'
                  ? 'Genera analisi DM →'
                  : 'Genera recap pubblico →'}
              </button>
            </div>
          </>
        ) : previewData ? (
          <>
            {/* STEP 2: Preview Summary and Customize */}
            <div className="lcfab__modal__title">
              {assetOpen && (
                <AssetsManagerModal
                  isOpen={assetOpen}
                  onClose={() => setAssetOpen(false)}
                  onSelect={(asset) => {
                    setBannerUrl(asset.url);
                    setAssetOpen(false);
                  }}
                />
              )}
              Preview & Customize Session
            </div>

            <label className="lcfab__modal__label">
              Title
            </label>
            <input
              className="lcfab__modal__input"
              placeholder="Session title"
              value={titleInput}
              onChange={(e) =>
                setTitleInput(e.target.value)
              }
            />

            <label className="lcfab__modal__label">
              Subtitle (optional)
            </label>
            <input
              className="lcfab__modal__input"
              placeholder="e.g., The Lost Temple"
              value={subtitleInput}
              onChange={(e) =>
                setSubtitleInput(e.target.value)
              }
            />

            <label className="lcfab__modal__label">
              Session Date
            </label>
            <input
              className="lcfab__modal__input"
              value={previewData.sessionDate || ''}
              disabled
              style={{
                opacity: 0.6,
                cursor: 'not-allowed',
              }}
            />

            <label className="lcfab__modal__label">
              World Date (optional)
            </label>
            {timeSystem ? (
              <DatePicker
                value={worldDate}
                onChange={(parts) =>
                  setWorldDate(parts)
                }
                ts={timeSystem}
                placeholder="Select world date"
                editable
              />
            ) : (
              <div
                style={{
                  fontSize: '0.9rem',
                  color: '#999',
                  marginBottom: '1rem',
                }}
              >
                Loading calendar...
              </div>
            )}

            <label className="lcfab__modal__label">
              Banner Image (optional)
            </label>
            {bannerUrl ? (
              <div className="banner-preview-wrapper">
                <div
                  className="bannerPreview"
                  style={{
                    backgroundImage: `url(${Api.resolveAssetUrl(
                      bannerUrl
                    )})`,
                  }}
                />
                <button
                  className="trash-btn"
                  type="button"
                  onClick={() => setBannerUrl('')}
                  title="Remove image"
                >
                  <TrashIcon color="white" size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="draggable__btn"
                onClick={() => setAssetOpen(true)}
              >
                Select Image
              </button>
            )}

            <label className="lcfab__modal__label">
              AI Summary
            </label>
            <div className="lcfab__modal__preview lcfab__modal__preview--editor">
              {editedSummaryRich && (
                <SummaryRichEditor
                  key={previewData.sessionDate}
                  content={editedSummaryRich}
                  onChange={setEditedSummaryRich}
                />
              )}
            </div>

            <div className="lcfab__modal__actions">
              <button
                className="modal__btn cancel"
                onClick={() => {
                  setPreviewStep(1);
                  setPreviewData(null);
                }}
              >
                ← Back
              </button>
              <button
                className="modal__btn primary"
                onClick={handleCreateFromPreview}
              >
                Create Page
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default SessionPreviewModal;
