import React, { useState } from 'react';
import Modal from 'react-modal';

interface PagePickerModalProps {
	isOpen: boolean;
	onClose: () => void;
	availablePages: any[];
	recapPageIds: string[];
	onToggleRecapPage: (pageId: string) => void;
	isLoadingPages?: boolean;
}

const PagePickerModal: React.FC<PagePickerModalProps> = ({
	isOpen,
	onClose,
	availablePages,
	recapPageIds,
	onToggleRecapPage,
	isLoadingPages = false,
}) => {
	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={onClose}
			contentLabel="Select Campaign Pages"
			className="modal__content modal__content--page-picker"
			overlayClassName="modal__overlay"
		>
			<div className="modal__body">
				<div className="modal__body_content">
					<h3
						style={{
							marginTop: 0,
							color: '#e6c896',
							fontSize: '1.25rem',
						}}
					>
						Select Campaign Pages for RECAP
					</h3>
					
					{isLoadingPages ? (
						<p style={{ color: '#94a3b8' }}>Loading pages...</p>
					) : availablePages.length === 0 ? (
						<p style={{ color: '#94a3b8' }}>
							No campaign pages available
						</p>
					) : (
						<div
							style={{
								maxHeight: '400px',
								overflowY: 'auto',
							}}
						>
							{availablePages
								.slice()
								.sort((a, b) => {
									const dateA = a.sessionDate ? new Date(a.sessionDate.split('/').reverse().join('-')) : new Date('9999-12-31');
									const dateB = b.sessionDate ? new Date(b.sessionDate.split('/').reverse().join('-')) : new Date('9999-12-31');
									return dateB.getTime() - dateA.getTime();
								})
								.map((page) => (
									<div
										key={page._id}
										style={{
											padding: '0.5rem',
											borderBottom: '1px solid #334155',
										}}
									>
									<label
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: '0.5rem',
											cursor: 'pointer',
											color: '#cbd5e1',
										}}
									>
										<div className="checkbox-wrapper">
											<input
												className="input-checkbox input-checkbox-light"
												type="checkbox"
												id={`hidden-checkbox-${page._id}`}
												checked={recapPageIds.includes(page._id!)}
												onChange={() => onToggleRecapPage(page._id!)}
											/>

											<label
												className="input-checkbox-btn"
												htmlFor={`hidden-checkbox-${page._id}`}
											></label>
											<span
												className="form-label"
												style={{
													marginBottom: '0',
												}}
											>
												{page.title}
											</span>
										</div>
									</label>
								</div>
							))}
						</div>
					)}
					
					<div
						className="modal__actions"
						style={{ marginTop: '1.5rem' }}
					>
						<button
							type="button"
							className="modal__btn btn-primary"
							onClick={onClose}
						>
							Done
						</button>
					</div>
				</div>
			</div>
		</Modal>
	);
};

export default PagePickerModal;