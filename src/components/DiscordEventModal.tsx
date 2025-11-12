import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-hot-toast';
import AssetsManagerModal from './AssetsManagerModal';
import { Trash } from 'phosphor-react';
import { useAppStore, type Asset } from '../store/appStore';
import SessionDatePicker from './SessionDatePicker';
import Api from '../Api';
import '../styles/DiscordEventModal.scss';
import Constants from '../Constants';

Modal.setAppElement('#root');

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
	const [title, setTitle] = useState('');
	const [bannerUrl, setBannerUrl] = useState('');
	const [assetOpen, setAssetOpen] = useState(false);
	// Session-style date string (DD/MM/YYYY)
	const [dateStr, setDateStr] = useState<string | null>(null);
	// Separate time selection to avoid timezone issues
	const [hour, setHour] = useState<string>('21');
	const [minute, setMinute] = useState<string>('30');
	const [channel, setChannel] = useState('');
	const [channels, setChannels] = useState<
		Array<{ id: string; name: string }>
	>([]);
	const [voiceChannel, setVoiceChannel] = useState('');
	const [voiceChannels, setVoiceChannels] = useState<
		Array<{ id: string; name: string }>
	>([]);
	const [guildId, setGuildId] = useState<string>('');
	const [isLoadingChannels, setIsLoadingChannels] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false);
	const [syncToCalendar, setSyncToCalendar] = useState(true);
	const [calendarId, setCalendarId] = useState('primary');
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
			lines.push('**RECAP:**');
			recapPageIds.forEach((pageId) => {
				const page = availablePages.find((p: any) => p._id === pageId);
				if (page) {
					const pageLabel = page.subtitle ? `${page.subtitle} - ${page.title}` : page.title;
					lines.push(`- ${pageLabel}: ${frontendOrigin}/lore/campaign/${pageId}`);
				}
			});
			lines.push('');
		}

		// TIMELINE - Always show Campaign timeline
		lines.push(`**TIMELINE:** ${frontendOrigin}/timeline?groups=Campaign`);
		lines.push('');

		// WEBCLIENT
		if (webclientUrl.trim()) {
			lines.push(`**WEBCLIENT:** ${webclientUrl.trim()}`);
			lines.push('');
		}

		// VOICE CHANNEL
		if (voiceChannel && guildId) {
			const selectedVoice = voiceChannels.find((vc) => vc.id === voiceChannel);
			if (selectedVoice) {
				lines.push(`**VOICE CHANNEL:** https://discord.com/channels/${guildId}/${voiceChannel}`);
			}
		}

		return lines.join('\n');
	}, [recapPageIds, availablePages, webclientUrl, voiceChannel, voiceChannels, guildId]);

	const loadCampaignPages = async () => {
		setIsLoadingPages(true);
		try {
			const pages = await Api.getPages('campaign');
			// Sort campaign pages by startDate descending (most recent first)
			const sortedPages = pages.sort((a: any, b: any) => {
				const dateA = a.sessionDate ? new Date(a.sessionDate).getTime() : 0;
				const dateB = b.sessionDate ? new Date(b.sessionDate).getTime() : 0;
				return dateB - dateA; // Descending order
			});
			setAvailablePages(sortedPages);
		} catch (err) {
			console.error('Failed to load campaign pages', err);
		} finally {
			setIsLoadingPages(false);
		}
	};

	const loadVoiceChannels = async () => {
		try {
			const resp = await Api.getDiscordVoiceChannels?.();
			if (resp && resp.channels) {
				setVoiceChannels(resp.channels);
				setGuildId(resp.guildId || '');
			} else {
				setVoiceChannels([]);
			}
		} catch (err) {
			console.error('Failed to load voice channels', err);
		}
	};

	const loadCalendars = async () => {
		setIsLoadingCalendars(true);
		try {
			const resp = await Api.getGoogleCalendars?.();
			if (resp && Array.isArray(resp)) {
				setCalendars(resp);
				// Auto-select primary calendar
				const primary = resp.find((cal) => cal.primary);
				if (primary) {
					setCalendarId(primary.id);
				}
			} else {
				setCalendars([]);
			}
		} catch (err) {
			console.error('Failed to load calendars', err);
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
			} else {
				setChannels([]);
			}
		} catch (err) {
			console.error('Failed to load channels', err);
			toast.error(
				'Failed to load Discord channels. Connect your Discord server in settings.'
			);
		} finally {
			setIsLoadingChannels(false);
		}
	};

	const handleCreate = async () => {
		if (!title.trim()) {
			toast.error('Event title is required');
			return;
		}
		if (!dateStr) {
			toast.error('Event date is required');
			return;
		}
		if (!channel) {
			toast.error('Please select a channel');
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
			const [dd, mm, yyyy] = (dateStr || '')
				.split('/')
				.map((v) => parseInt(v, 10));
			const h = parseInt(hour, 10) || 0;
			const m = parseInt(minute, 10) || 0;
			const localDate = new Date(
				yyyy,
				(mm || 1) - 1,
				dd || 1,
				h,
				m,
				0,
				0
			);
			const payload = {
				title,
				description: buildDescription,
				bannerUrl,
				dateTimeUtc: localDate.toISOString(),
				channelId: channel,
				voiceChannelId: voiceChannel || undefined,
				syncToCalendar,
				calendarId: syncToCalendar ? calendarId : undefined,
			};

			console.log('Creating Discord event:', payload);

			// Try backend if available
			if (Api.createDiscordEvent) {
				await Api.createDiscordEvent(payload);
			} else {
				// Fallback mock
				await new Promise((resolve) => setTimeout(resolve, 1200));
			}

			toast.success('Discord event created successfully!');
			handleClose();
		} catch (err: any) {
			console.error('Failed to create Discord event', err);
			toast.error(err?.message || 'Failed to create Discord event');
		} finally {
			setIsCreating(false);
		}
	};

	const handleClose = () => {
		setTitle('');
		setBannerUrl('');
		setDateStr(null);
		setChannel('');
		setVoiceChannel('');
		setDropdownOpen(false);
		setVoiceDropdownOpen(false);
		setRecapPageIds([]);
		setWebclientUrl(Constants.FVTT_URL);
		onClose();
	};

	const toggleRecapPage = (pageId: string) => {
		setRecapPageIds((prev) =>
			prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
		);
	};

	const selectedChannel = channels.find((ch) => ch.id === channel);

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
								fontSize: '1.5rem',
								color: '#e6c896',
								marginBottom: '0.5rem',
							}}
						>
							Create Discord Event
						</h2>
						<p
							style={{
								fontSize: '0.85rem',
								color: '#94a3b8',
								marginBottom: '1.5rem',
							}}
						>
							Schedule an event on Discord and sync with Google
							Calendar
						</p>

						<div className="modal__two-columns">
							{/* LEFT COLUMN - Event Details */}
							<div className="modal__column modal__column--left">
						{/* Event Title */}
						<div className="form-group">
							<label className="form-label">Event Title</label>
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Enter event title..."
								className="modal__input"
							/>
						</div>

						{/* Banner Image */}
						<div className="form-group">
							<label className="form-label">Event Image</label>
							{bannerUrl ? (
								<div className="banner-preview-wrapper">
									<div
										className="banner-preview"
										style={{
											backgroundImage: `url(${resolveAssetUrl(
												bannerUrl
											)})`,
										}}
									/>
									<button
										type="button"
										className="trash-btn"
										onClick={() => setBannerUrl('')}
										title="Remove image"
									>
										<Trash color="white" size={18} />
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
						</div>

						{/* Event Date & Time (custom) */}
						<div className="form-group">
							<label className="form-label">
								Event Date & Time
							</label>
							<div className="date-time-row">
								<SessionDatePicker
									value={dateStr}
									placeholder="Select a date"
									onChange={setDateStr}
								/>
								<div className="time-fields">
									<select
										className="modal__select"
										value={hour}
										onChange={(e) =>
											setHour(e.target.value)
										}
										aria-label="Hours"
									>
										{Array.from({ length: 24 }).map(
											(_, i) => (
												<option
													key={i}
													value={String(i).padStart(
														2,
														'0'
													)}
												>
													{String(i).padStart(2, '0')}
												</option>
											)
										)}
									</select>
									<span className="time-sep">:</span>
									<select
										className="modal__select"
										value={minute}
										onChange={(e) =>
											setMinute(e.target.value)
										}
										aria-label="Minutes"
									>
										{Array.from({ length: 12 }).map(
											(_, i) => {
												const mm = i * 5;
												return (
													<option
														key={mm}
														value={String(
															mm
														).padStart(2, '0')}
													>
														{String(mm).padStart(
															2,
															'0'
														)}
													</option>
												);
											}
										)}
									</select>
								</div>
							</div>
						</div>

						{/* Event Channel Dropdown */}
						<div className="form-group">
							<label className="form-label">
								Event Channel
							</label>
							<div
								className="custom-dropdown"
								style={{ position: 'relative', zIndex: 50 }}
							>
								<button
									type="button"
									className="dropdown-trigger"
									onClick={(e) => {
										setDropdownOpen(!dropdownOpen);
										// Set CSS var for max dropdown height based on viewport position
										const rect =
											e.currentTarget.getBoundingClientRect();
										document.documentElement.style.setProperty(
											'--popup-top',
											`${rect.bottom}px`
										);
									}}
									disabled={isLoadingChannels}
								>
									{isLoadingChannels
										? 'Loading channels...'
										: selectedChannel
										? `# ${selectedChannel.name}`
										: 'Select a channel'}
									<span className="dropdown-arrow">▼</span>
								</button>
								{dropdownOpen && (
									<div className="dropdown-popup">
										{channels.map((ch) => (
											<div
												key={ch.id}
												className="dropdown-item"
												onClick={() => {
													setChannel(ch.id);
													setDropdownOpen(false);
												}}
											>
												# {ch.name}
											</div>
										))}
									</div>
								)}
							</div>
						</div>

						{/* Voice Channel Dropdown */}
						<div className="form-group">
							<label className="form-label">
								Voice Channel (optional)
							</label>
							<div
								className="custom-dropdown"
								style={{ position: 'relative', zIndex: 49 }}
							>
								<button
									type="button"
									className="dropdown-trigger"
									onClick={(e) => {
										setVoiceDropdownOpen(!voiceDropdownOpen);
										const rect =
											e.currentTarget.getBoundingClientRect();
										document.documentElement.style.setProperty(
											'--popup-top',
											`${rect.bottom}px`
										);
									}}
								>
									{voiceChannels.length === 0
										? 'No voice channels'
										: voiceChannel
										? `🔊 ${voiceChannels.find((vc) => vc.id === voiceChannel)?.name}`
										: 'Select a voice channel'}
									<span className="dropdown-arrow">▼</span>
								</button>
								{voiceDropdownOpen && voiceChannels.length > 0 && (
									<div className="dropdown-popup">
										<div
											className="dropdown-item"
											onClick={() => {
												setVoiceChannel('');
												setVoiceDropdownOpen(false);
											}}
										>
											None
										</div>
										{voiceChannels.map((vc) => (
											<div
												key={vc.id}
												className="dropdown-item"
												onClick={() => {
													setVoiceChannel(vc.id);
													setVoiceDropdownOpen(false);
												}}
											>
												🔊 {vc.name}
											</div>
										))}
									</div>
								)}
							</div>
						</div>
							</div>
							{/* RIGHT COLUMN - Description Builder */}
							<div className="modal__column modal__column--right">

						{/* Description Builder */}
						<div className="form-group">
							<label className="form-label">Event Description</label>
							
							{/* RECAP Section */}
							<div style={{ marginBottom: '1rem' }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
									<span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>RECAP:</span>
									<button 
										type="button" 
										className="btn-text-small" 
										onClick={() => setPagePickerOpen(true)}
										style={{ 
											background: 'none', 
											border: 'none', 
											color: '#e6c896', 
											cursor: 'pointer', 
											fontSize: '0.8rem',
											textDecoration: 'underline'
										}}
									>
										{recapPageIds.length === 0 ? 'Add Campaign Pages' : `${recapPageIds.length} page(s) selected`}
									</button>
								</div>
								{recapPageIds.length > 0 && (
									<div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
										{recapPageIds.map((pageId) => {
											const page = availablePages.find((p: any) => p._id === pageId);
											return page ? (
												<div 
													key={pageId} 
													style={{ 
														display: 'inline-flex', 
														alignItems: 'center', 
														gap: '0.25rem', 
														background: '#1e293b', 
														padding: '0.25rem 0.5rem', 
														borderRadius: '4px',
														fontSize: '0.8rem',
														color: '#cbd5e1'
													}}
												>
													<span>{page.title}</span>
													<button
														type="button"
														onClick={() => toggleRecapPage(pageId)}
														aria-label="Remove"
														style={{ 
															background: 'transparent', 
															border: 'none', 
															cursor: 'pointer', 
															color: '#94a3b8',
															padding: '0',
															display: 'flex',
															alignItems: 'center'
														}}
													>
														×
													</button>
												</div>
											) : null;
										})}
									</div>
								)}
							</div>

							{/* TIMELINE Section */}
							{linkedEventId && (
								<div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
									<span>TIMELINE: Auto-generated link to campaign group</span>
								</div>
							)}

							{/* WEBCLIENT Section */}
							<div style={{ marginBottom: '1rem' }}>
								<div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>WEBCLIENT:</div>
								<input
									type="text"
									value={webclientUrl}
									onChange={(e) => setWebclientUrl(e.target.value)}
									placeholder="Enter webclient URL..."
									className="modal__input"
								/>
							</div>

							{/* Description Preview */}
							<div style={{ marginTop: '1rem' }}>
								<div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Preview:</div>
								<pre style={{ 
									whiteSpace: 'pre-wrap', 
									wordWrap: 'break-word',
									wordBreak: 'break-all',
									overflowWrap: 'break-word',
									fontSize: '0.75rem', 
									color: '#cbd5e1', 
									background: '#1e293b', 
									padding: '0.75rem', 
									borderRadius: '4px', 
									maxHeight: '200px', 
									overflow: 'auto',
									border: '1px solid #334155',
									margin: 0
								}}>
									{buildDescription || '(Description will appear here)'}
								</pre>
							</div>
						</div>

						{/* Google Calendar Sync */}
						<div className="form-group">
							<div className="checkbox-wrapper">
								<input
									className="input-checkbox input-checkbox-light"
									type="checkbox"
									id="hidden-checkbox"
									checked={syncToCalendar}
									onChange={(e) => {
										setSyncToCalendar(e.target.checked);
									}}
								/>

								<label
									className="input-checkbox-btn"
									htmlFor="hidden-checkbox"
								></label>
								<span
									className="form-label"
									style={{ marginBottom: '0' }}
								>
									Sync to Google Calendar
								</span>
							</div>

							{/* Calendar Selector - shown when sync is enabled */}
							{syncToCalendar && (
								<div style={{ marginTop: '1rem' }}>
									<label className="form-label">
										Select Calendar
									</label>
									<div
										className="custom-dropdown"
										style={{
											position: 'relative',
											zIndex: 40,
										}}
									>
										<button
											type="button"
											className="dropdown-trigger"
											onClick={(e) => {
												setCalendarDropdownOpen(
													!calendarDropdownOpen
												);
												// Set CSS var for max dropdown height based on viewport position
												const rect =
													e.currentTarget.getBoundingClientRect();
												document.documentElement.style.setProperty(
													'--popup-top',
													`${rect.bottom}px`
												);
											}}
											disabled={isLoadingCalendars}
										>
											{isLoadingCalendars
												? 'Loading calendars...'
												: calendars.length === 0
												? 'No calendars found'
												: calendars.find(
														(cal) =>
															cal.id ===
															calendarId
												  )?.name ||
												  'Select a calendar'}
											<span className="dropdown-arrow">
												▼
											</span>
										</button>
										{calendarDropdownOpen &&
											calendars.length > 0 && (
												<div className="dropdown-popup">
													{calendars.map((cal) => (
														<div
															key={cal.id}
															className="dropdown-item"
															onClick={() => {
																setCalendarId(
																	cal.id
																);
																setCalendarDropdownOpen(
																	false
																);
															}}
														>
															{cal.name}{' '}
															{cal.primary &&
																'(Primary)'}
														</div>
													))}
												</div>
											)}
									</div>
								</div>
							)}
						</div>
							</div>
						</div>

						{/* Actions */}
						<div
							className="modal__actions"
							style={{ marginTop: '2rem' }}
						>
							<button
								type="button"
								className="modal__btn cancel btn-muted"
								onClick={handleClose}
								disabled={isCreating}
							>
								Cancel
							</button>
							<button
								type="button"
								className="modal__btn btn-primary"
								onClick={handleCreate}
								disabled={isCreating}
							>
								{isCreating ? 'Creating...' : 'Create Event'}
							</button>
						</div>
					</div>
				</div>
			</Modal>

			{/* Page Picker Modal */}
			<Modal
				isOpen={pagePickerOpen}
				onRequestClose={() => setPagePickerOpen(false)}
				contentLabel="Select Campaign Pages"
				className="modal__content modal__content--page-picker"
				overlayClassName="modal__overlay"
			>
				<div className="modal__body">
					<div className="modal__body_content">
						<h3 style={{ marginTop: 0, color: '#e6c896', fontSize: '1.25rem' }}>
							Select Campaign Pages for RECAP
						</h3>
						{isLoadingPages ? (
							<p style={{ color: '#94a3b8' }}>Loading pages...</p>
						) : availablePages.length === 0 ? (
							<p style={{ color: '#94a3b8' }}>No campaign pages available</p>
						) : (
							<div style={{ maxHeight: '400px', overflowY: 'auto' }}>
								{availablePages.map((page: any) => (
									<div 
										key={page._id} 
										style={{ 
											padding: '0.5rem',
											borderBottom: '1px solid #334155'
										}}
									>
										<label 
											style={{ 
												display: 'flex', 
												alignItems: 'center', 
												gap: '0.5rem', 
												cursor: 'pointer',
												color: '#cbd5e1'
											}}
										>
											<input
												type="checkbox"
												checked={recapPageIds.includes(page._id!)}
												onChange={() => toggleRecapPage(page._id!)}
												style={{ cursor: 'pointer' }}
											/>
											<span>{page.title}</span>
										</label>
									</div>
								))}
							</div>
						)}
						<div className="modal__actions" style={{ marginTop: '1.5rem' }}>
							<button 
								type="button" 
								className="modal__btn btn-primary" 
								onClick={() => setPagePickerOpen(false)}
							>
								Done
							</button>
						</div>
					</div>
				</div>
			</Modal>

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
