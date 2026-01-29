import React from 'react';
import { toast } from 'react-hot-toast';
import Api from '../../Api';
import { useAppStore } from '../../store/appStore';

interface SyncFromGoogleDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  docInput: string;
  setDocInput: (value: string) => void;
  summarize: boolean;
  setSummarize: (value: boolean) => void;
  isLoadingPreview: boolean;
  setIsLoadingPreview: (value: boolean) => void;
  availableDates: Array<{ date: string; content: string }>;
  setAvailableDates: (value: Array<{ date: string; content: string }>) => void;
  setSelectedDate: (value: string) => void;
  setPreviewStep: (value: number) => void;
  setPreviewData: (value: any) => void;
  setTitleInput: (value: string) => void;
  setSubtitleInput: (value: string) => void;
  setWorldDate: (value: any) => void;
  setBannerUrl: (value: string) => void;
  setPreviewOpen: (value: boolean) => void;
}

const SyncFromGoogleDocsModal: React.FC<SyncFromGoogleDocsModalProps> = ({
  isOpen,
  onClose,
  docInput,
  setDocInput,
  summarize,
  setSummarize,
  isLoadingPreview,
  setIsLoadingPreview,
  availableDates,
  setAvailableDates,
  setSelectedDate,
  setPreviewStep,
  setPreviewData,
  setTitleInput,
  setSubtitleInput,
  setWorldDate,
  setBannerUrl,
  setPreviewOpen,
}) => {
  const isDM = useAppStore((s) => s.isDM());
  const user = useAppStore((s) => s.user);

  const extractDocId = (input: string): string | null => {
    if (!input) return null;
    const trimmed = input.trim();
    // If it's already an id-like string
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
    // Try to parse from a Google Docs URL
    const m = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  };

  const handleSyncFromDrive = async () => {
    if (!isDM) {
      toast.error('Only DMs can sync from Drive');
      return;
    }
    const docId = extractDocId(docInput);
    if (!docId) {
      toast.error('Please paste a valid Google Doc URL or ID');
      return;
    }
    localStorage.setItem('drive_doc_input', docInput);
    setIsLoadingPreview(true);

    try {
      const tId = toast.loading('Fetching available sessions…', {
        id: 'sync-preview',
      });
      const googleAccessToken =
        user?.googleAccessToken ||
        localStorage.getItem('googleAccessToken');

      // Step 1: Call preview endpoint to get available dates
      const resp = await fetch(
        `${Api.getBaseUrl()}/sync/campaign/preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({
            docId,
            googleAccessToken,
          }),
        }
      );
      const data = await resp.json();

      if (!resp.ok) {
        // Check if token expired
        if (resp.status === 401 || data?.error?.includes('token')) {
          toast.loading('Google token expired. Refreshing...', {
            id: tId,
          });
          const refreshResult = await Api.refreshGoogleToken();
          if (refreshResult.success) {
            toast.loading('Token refreshed. Retrying...', {
              id: tId,
            });

            // Update user state with new token
            if (user && refreshResult.googleAccessToken) {
              const updatedUser = {
                ...user,
                googleAccessToken: refreshResult.googleAccessToken,
              };
              useAppStore.getState().setUser(updatedUser);
            }

            // Retry the request with new token
            const retryResp = await fetch(
              `${Api.getBaseUrl()}/sync/campaign/preview`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
                },
                body: JSON.stringify({
                  docId,
                  googleAccessToken: refreshResult.googleAccessToken,
                }),
              }
            );
            const retryData = await retryResp.json();

            if (!retryResp.ok) {
              throw new Error(
                retryData?.error ||
                  'Preview failed after token refresh'
              );
            }

            if (
              !retryData?.availableDates ||
              retryData.availableDates.length === 0
            ) {
              toast.dismiss(tId);
              toast(
                retryData?.message || 'No new sessions found'
              );
              return;
            }

            // Success - show preview modal with date selection
            toast.success(
              `Found ${retryData.availableDates.length} session(s)`,
              { id: tId }
            );
            setAvailableDates(retryData.availableDates);
            setSelectedDate(retryData.availableDates[0].date);
            setPreviewStep(1);
            setPreviewData(null);
            setTitleInput('');
            setSubtitleInput('');
            setWorldDate(null);
            setBannerUrl('');
            onClose();
            setPreviewOpen(true);
            return;
          } else if (refreshResult.needsReauth) {
            toast.error('Please reconnect your Google account', {
              id: tId,
            });
            return;
          } else {
            toast.error('Failed to refresh token', {
              id: tId,
            });
            return;
          }
        }
        throw new Error(data?.error || 'Preview failed');
      }

      if (!data?.availableDates || data.availableDates.length === 0) {
        toast.dismiss(tId);
        toast(data?.message || 'No new sessions found');
        return;
      }

      // Success - show preview modal with date selection
      toast.success(`Found ${data.availableDates.length} session(s)`, {
        id: tId,
      });
      setAvailableDates(data.availableDates);
      setSelectedDate(data.availableDates[0].date); // Pre-select most recent
      setPreviewStep(1);
      setPreviewData(null); // Clear previous summary
      setTitleInput('');
      setSubtitleInput('');
      setWorldDate(null);
      setBannerUrl('');
      onClose();
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(e?.message || 'Preview failed');
    } finally {
      setIsLoadingPreview(false);
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
      <div className="lcfab__modal__card" role="document">
        <div className="lcfab__modal__title">
          Sync from Google Docs
        </div>
        <label className="lcfab__modal__label">
          Doc URL or ID
        </label>
        <input
          className="lcfab__modal__input"
          placeholder="https://docs.google.com/document/d/… or ID"
          value={docInput}
          onChange={(e) => setDocInput(e.target.value)}
        />

        <div className="checkbox-wrapper">
          <input
            id="summary-checkbox"
            type="checkbox"
            checked={summarize}
            className="input-checkbox input-checkbox-light"
            onChange={(e) => setSummarize(e.target.checked)}
          />

          <label
            className="input-checkbox-btn"
            htmlFor="summary-checkbox"
          ></label>
          <span className="form-label">
            Summarize with AI (if available)
          </span>
        </div>

        <div className="lcfab__modal__actions">
          <button
            className="modal__btn cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="modal__btn primary"
            onClick={handleSyncFromDrive}
            disabled={isLoadingPreview}
          >
            {isLoadingPreview ? 'Loading…' : 'Preview'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncFromGoogleDocsModal;