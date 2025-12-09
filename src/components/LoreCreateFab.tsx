import { BooksIcon } from '@phosphor-icons/react/dist/csr/Books';
import { GlobeHemisphereWestIcon } from '@phosphor-icons/react/dist/csr/GlobeHemisphereWest';
import { SparkleIcon } from '@phosphor-icons/react/dist/csr/Sparkle';
import { UsersThreeIcon } from '@phosphor-icons/react/dist/csr/UsersThree';
import { CloudArrowDownIcon } from '@phosphor-icons/react/dist/csr/CloudArrowDown';
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash';
import { DiscordLogoIcon } from '@phosphor-icons/react/dist/csr/DiscordLogo';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Api from '../Api';
import { toast } from 'react-hot-toast';
import { useAppStore } from '../store/appStore';
import DatePicker from './DatePicker';
import AssetsManagerModal from './AssetsManagerModal';
import DiscordEventModal from './DiscordEventModal';

type LoreType = 'history' | 'campaign' | 'people' | 'myth';

const LoreCreateFab: React.FC = () => {
	const [open, setOpen] = useState(false);
	const [syncOpen, setSyncOpen] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [discordEventOpen, setDiscordEventOpen] = useState(false);
	const [docInput, setDocInput] = useState<string>(
		() =>
			localStorage.getItem('drive_doc_input') ||
			process.env.REACT_APP_GOOGLE_DOC_URL ||
			''
	);
	const [summarize, setSummarize] = useState<boolean>(true);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);
	const [isLoadingSummary, setIsLoadingSummary] = useState(false);

	// Available dates from backend (Step 1)
	const [availableDates, setAvailableDates] = useState<
		Array<{ date: string; content: string }>
	>([]);
	const [selectedDate, setSelectedDate] = useState<string>('');
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	// Preview data from backend (Step 2)
	const [previewData, setPreviewData] = useState<any>(null);

	// Modal step: 1 = select date, 2 = preview summary
	const [previewStep, setPreviewStep] = useState<1 | 2>(1);

	// Editable fields for the preview modal
	const [titleInput, setTitleInput] = useState<string>('');
	const [subtitleInput, setSubtitleInput] = useState<string>('');
	const [worldDate, setWorldDate] = useState<any>(null);
	const [bannerUrl, setBannerUrl] = useState<string>('');
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
		const onKey = (e: KeyboardEvent) =>
			e.key === 'Escape' && setOpen(false);
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open]);

	// Close sync modal with Escape
	useEffect(() => {
		if (!syncOpen) return;
		const onKey = (e: KeyboardEvent) =>
			e.key === 'Escape' && setSyncOpen(false);
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [syncOpen]);

	// Close preview modal with Escape
	useEffect(() => {
		if (!previewOpen) return;
		const onKey = (e: KeyboardEvent) =>
			e.key === 'Escape' && setPreviewOpen(false);
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
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
		document.addEventListener('mousedown', onPointerDown);
		document.addEventListener('touchstart', onPointerDown, {
			passive: true,
		});
		return () => {
			document.removeEventListener('mousedown', onPointerDown);
			document.removeEventListener('touchstart', onPointerDown);
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
			document.addEventListener('mousedown', handleClickOutside);
			return () =>
				document.removeEventListener('mousedown', handleClickOutside);
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
						Authorization: `Bearer ${
							localStorage.getItem('token') || ''
						}`,
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
								googleAccessToken:
									refreshResult.googleAccessToken,
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
									Authorization: `Bearer ${
										localStorage.getItem('token') || ''
									}`,
								},
								body: JSON.stringify({
									docId,
									googleAccessToken:
										refreshResult.googleAccessToken,
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
						setSyncOpen(false);
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
			setSyncOpen(false);
			setPreviewOpen(true);
		} catch (e: any) {
			toast.error(e?.message || 'Preview failed');
		} finally {
			setIsLoadingPreview(false);
		}
	};

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
						Authorization: `Bearer ${
							localStorage.getItem('token') || ''
						}`,
					},
					body: JSON.stringify({
						rawText: selectedSession.content,
						sessionDate: selectedDate,
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
						Authorization: `Bearer ${
							localStorage.getItem('token') || ''
						}`,
					},
					body: JSON.stringify({
						summary: previewData.summary,
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
				navigate(`/lore/campaign/${data.created._id}`);
				setPreviewOpen(false);
				setOpen(false);
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

	const onSurfaceKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (
		e
	) => {
		if (!open && (e.key === 'Enter' || e.key === ' ')) {
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
					role={!open ? 'button' : undefined}
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
					<div
						id="lcfab-panel"
						className="lcfab__content"
						aria-hidden={!open}
					>
						<div className="lcfab__content_wrapper">
							<div
								className="lcfab__content_wrapper--option history-option"
								onClick={() => handleCreate('history')}
							>
								<BooksIcon
									size={18}
									className="lcfab__content_wrapper--option-icon"
								/>
								History
							</div>
							<div
								className="lcfab__content_wrapper--option campaign-option"
								onClick={() => handleCreate('campaign')}
							>
								<GlobeHemisphereWestIcon
									size={18}
									className="lcfab__content_wrapper--option-icon"
								/>
								Campaign
							</div>
							<div
								className="lcfab__content_wrapper--option myth-option"
								onClick={() => handleCreate('myth')}
							>
								<SparkleIcon
									size={18}
									className="lcfab__content_wrapper--option-icon"
								/>
								Myths
							</div>
							<div
								className="lcfab__content_wrapper--option people-option"
								onClick={() => handleCreate('people')}
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
			{syncOpen && isDM && (
				<div
					className="lcfab__modal"
					role="dialog"
					aria-modal="true"
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) setSyncOpen(false);
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
								onClick={() => setSyncOpen(false)}
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
			)}

			{previewOpen && isDM && (
				<div
					className="lcfab__modal"
					role="dialog"
					aria-modal="true"
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) setPreviewOpen(false);
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

								<div className="lcfab__modal__actions">
									<button
										className="modal__btn cancel"
										onClick={() => {
											setPreviewOpen(false);
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
											: 'Summarize with AI →'}
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
									AI Summary Preview
								</label>
								<div className="lcfab__modal__preview">
									{previewData.summary || 'No content'}
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
			)}

			<DiscordEventModal
				isOpen={discordEventOpen}
				onClose={() => setDiscordEventOpen(false)}
			/>
		</>
	);
};

export default LoreCreateFab;
