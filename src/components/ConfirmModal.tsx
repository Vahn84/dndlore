import React from 'react';
import ReactDOM from 'react-dom';
import '../styles/ConfirmModal.scss';

interface ConfirmModalProps {
	isOpen: boolean;
	title?: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	onCancel?: () => void; // Optional - if not provided, only shows confirm button
	variant?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
	isOpen,
	title = 'Confirm Action',
	message,
	confirmText = 'Confirm',
	cancelText = 'Cancel',
	onConfirm,
	onCancel,
	variant = 'warning',
}) => {
	if (!isOpen) return null;

	const modalRoot = document.getElementById('modal-root');
	if (!modalRoot) return null;

	const handleOverlayClick = () => {
		if (onCancel) {
			onCancel();
		}
	};

	return ReactDOM.createPortal(
		<div className="confirm-modal-overlay" onClick={handleOverlayClick}>
			<div
				className="confirm-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="confirm-modal-header">
					<h3>{title}</h3>
				</div>
				<div className="confirm-modal-body">
					<p>{message}</p>
				</div>
				<div className="confirm-modal-actions">
					{onCancel && (
						<button
							className="btn-cancel"
							onClick={onCancel}
							autoFocus={!!onCancel}
						>
							{cancelText}
						</button>
					)}
					<button
						className={`btn-confirm btn-confirm--${variant}`}
						onClick={onConfirm}
						autoFocus={!onCancel}
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>,
		modalRoot
	);
};

export default ConfirmModal;
