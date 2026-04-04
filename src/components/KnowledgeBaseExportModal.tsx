import React from "react";
import Modal from "react-modal";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { XCircleIcon } from "@phosphor-icons/react/dist/csr/XCircle";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import "../styles/KnowledgeBaseExportModal.scss";

interface KnowledgeBaseExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exporting: boolean;
  progress: {
    total: number;
    uploaded: number;
    failed: number;
    updated: number;
  };
}

const KnowledgeBaseExportModal: React.FC<KnowledgeBaseExportModalProps> = ({
  isOpen,
  onClose,
  exporting,
  progress,
}) => {
  Modal.setAppElement("#root");

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.uploaded / progress.total) * 100)
      : 0;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={exporting ? undefined : onClose}
      contentLabel="Sync to Knowledge Base"
      className="modal__content modal__content--kb-export"
      overlayClassName="modal__overlay"
    >
      <div className="modal__body">
        <div className="modal__body_content">
          <h2 className="kb-export__title">
            {exporting ? "Syncing to Knowledge Base…" : "Sync Complete"}
          </h2>

          {exporting ? (
            <div className="kb-export__progress">
              <div className="kb-export__bar">
                <div
                  className="kb-export__bar-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="kb-export__hint">
                Syncing {progress.total} pages, please wait…
              </p>
            </div>
          ) : (
            <div className="kb-export__summary">
              <div className="kb-export__row">
                <span className="kb-export__label">Total pages</span>
                <span className="kb-export__value">{progress.total}</span>
              </div>
              <div className="kb-export__row">
                <CheckCircleIcon size={16} className="kb-export__icon kb-export__icon--ok" />
                <span className="kb-export__label">Synced</span>
                <span className="kb-export__value kb-export__value--ok">
                  {progress.uploaded}
                </span>
              </div>
              {progress.failed > 0 && (
                <div className="kb-export__row">
                  <XCircleIcon size={16} className="kb-export__icon kb-export__icon--err" />
                  <span className="kb-export__label">Failed</span>
                  <span className="kb-export__value kb-export__value--err">
                    {progress.failed}
                  </span>
                </div>
              )}
            </div>
          )}

          {!exporting && (
            <div className="kb-export__actions">
              <button className="kb-export__btn-close" onClick={onClose}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default KnowledgeBaseExportModal;
