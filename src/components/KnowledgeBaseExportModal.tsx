import React from "react";
import Modal from "react-modal";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { XCircleIcon } from "@phosphor-icons/react/dist/csr/XCircle";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import "./KnowledgeBaseExportModal.scss";

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
    progress.total > 0 ? Math.round((progress.uploaded / progress.total) * 100) : 0;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Export to Knowledge Base"
      className="kb-export-modal"
      overlayClassName="kb-export-modal-overlay"
    >
      <h2>Export to Knowledge Base</h2>

      {exporting ? (
        <div className="export-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="progress-stats">
            <div className="stat uploaded">
              <CheckCircleIcon size={20} />
              <span>{progress.uploaded}</span>
            </div>
            <div className="stat updated">
              <SpinnerGapIcon size={20} />
              <span>{progress.updated} updated</span>
            </div>
            {progress.failed > 0 && (
              <div className="stat failed">
                <XCircleIcon size={20} />
                <span>{progress.failed} failed</span>
              </div>
            )}
          </div>
          <p>Exporting {progress.total} pages...</p>
        </div>
      ) : (
        <div className="export-summary">
          <div className="summary-row">
            <span className="label">Total pages:</span>
            <span className="value">{progress.total}</span>
          </div>
          <div className="summary-row">
            <span className="label">Uploaded:</span>
            <span className="value uploaded">{progress.uploaded}</span>
          </div>
          {progress.updated > 0 && (
            <div className="summary-row">
              <span className="label">Updated:</span>
              <span className="value updated">{progress.updated}</span>
            </div>
          )}
          {progress.failed > 0 && (
            <div className="summary-row">
              <span className="label">Failed:</span>
              <span className="value failed">{progress.failed}</span>
            </div>
          )}
        </div>
      )}

      <div className="modal-actions">
        <button className="btn-primary" onClick={onClose}>
          Close
        </button>
        {!exporting && progress.failed > 0 && (
          <button
            className="btn-secondary"
            onClick={() =>
              alert("Failed pages details would be shown here")
            }
          >
            View Details
          </button>
        )}
      </div>
    </Modal>
  );
};

export default KnowledgeBaseExportModal;
