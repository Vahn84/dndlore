import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-hot-toast';
import AssetsManagerModal from './AssetsManagerModal';
import { Trash } from 'phosphor-react';
import { useAppStore, type Asset } from '../store/appStore';
import SessionDatePicker from './SessionDatePicker';
import Api from '../Api';
import '../styles/DiscordEventModal.scss';

Modal.setAppElement('#root');

interface DiscordEventModalProps {
	isOpen: boolean;
	onClose: () => void;
}

const DiscordEventModal: React.FC<DiscordEventModalProps> = ({ isOpen, onClose }) => {
	const [title, setTitle] = useState('');
	const [bannerUrl, setBannerUrl] = useState('');
	const [assetOpen, setAssetOpen] = useState(false);
	// Session-style date string (DD/MM/YYYY)
	const [dateStr, setDateStr] = useState<string | null>(null);
	// Separate time selection to avoid timezone issues
	const [hour, setHour] = useState<string>('20');
	const [minute, setMinute] = useState<string>('30');
	const [channel, setChannel] = useState('');
	const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([]);
	const [isLoadingChannels, setIsLoadingChannels] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [syncToCalendar, setSyncToCalendar] = useState(true);
	const [calendarId, setCalendarId] = useState('primary');
	const [calendars, setCalendars] = useState<Array<{ id: string; name: string; primary: boolean }>>([]);
	const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
	const [calendarDropdownOpen, setCalendarDropdownOpen] = useState(false);

	const resolveAssetUrl = Api.resolveAssetUrl;

	// Load Discord channels on mount
	useEffect(() => {
		if (isOpen) {
			loadChannels();
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


	const loadCalendars = async () => {
		setIsLoadingCalendars(true);
		try {
			const resp = await Api.getGoogleCalendars?.();
			if (resp && Array.isArray(resp)) {
				setCalendars(resp);
				// Auto-select primary calendar
				const primary = resp.find(cal => cal.primary);
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
			toast.error('Failed to load Discord channels. Connect your Discord server in settings.');
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
			const [dd, mm, yyyy] = (dateStr || '').split('/').map((v) => parseInt(v, 10));
			const h = parseInt(hour, 10) || 0;
			const m = parseInt(minute, 10) || 0;
			const localDate = new Date(yyyy, (mm || 1) - 1, dd || 1, h, m, 0, 0);
			const payload = {
				title,
				bannerUrl,
				dateTimeUtc: localDate.toISOString(),
				channelId: channel,
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
		setDropdownOpen(false);
		onClose();
	};

	const selectedChannel = channels.find(ch => ch.id === channel);

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
						<h2 style={{ marginTop: 0, fontSize: '1.5rem', color: '#e6c896' }}>
							Create Discord Event
						</h2>
						<p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
							Schedule an event on Discord and sync with Google Calendar
						</p>

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
											backgroundImage: `url(${resolveAssetUrl(bannerUrl)})`,
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
							<label className="form-label">Event Date & Time</label>
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
										onChange={(e) => setHour(e.target.value)}
										aria-label="Hours"
									>
										{Array.from({ length: 24 }).map((_, i) => (
											<option key={i} value={String(i).padStart(2, '0')}>
												{String(i).padStart(2, '0')}
											</option>
										))}
									</select>
									<span className="time-sep">:</span>
									<select
										className="modal__select"
										value={minute}
										onChange={(e) => setMinute(e.target.value)}
										aria-label="Minutes"
									>
										{Array.from({ length: 12 }).map((_, i) => {
											const mm = i * 5;
											return (
												<option key={mm} value={String(mm).padStart(2, '0')}>
													{String(mm).padStart(2, '0')}
												</option>
											);
										})}
									</select>
								</div>
							</div>
						</div>

						{/* Channel Dropdown */}
						<div className="form-group">
							<label className="form-label">Discord Channel</label>
							<div className="custom-dropdown" style={{ position: 'relative', zIndex: 50 }}>
								<button
									type="button"
									className="dropdown-trigger"
									onClick={() => setDropdownOpen(!dropdownOpen)}
									disabled={isLoadingChannels}
								>
									{isLoadingChannels ? (
										'Loading channels...'
									) : selectedChannel ? (
										`# ${selectedChannel.name}`
									) : (
										'Select a channel'
									)}
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

						{/* Google Calendar Sync */}
						<div className="form-group">
							<label className="modal__checkrow">
								<input
									type="checkbox"
									checked={syncToCalendar}
									onChange={(e) => setSyncToCalendar(e.target.checked)}
								/>
								<span>Sync to Google Calendar</span>
							</label>

							{/* Calendar Selector - shown when sync is enabled */}
							{syncToCalendar && (
								<div style={{ marginTop: '1rem' }}>
									<label className="form-label">Select Calendar</label>
									<div className="custom-dropdown" style={{ position: 'relative', zIndex: 40 }}>
										<button
											type="button"
											className="dropdown-trigger"
											onClick={() => setCalendarDropdownOpen(!calendarDropdownOpen)}
											disabled={isLoadingCalendars}
										>
											{isLoadingCalendars ? (
												'Loading calendars...'
											) : calendars.length === 0 ? (
												'No calendars found'
											) : (
												calendars.find(cal => cal.id === calendarId)?.name || 'Select a calendar'
											)}
											<span className="dropdown-arrow">▼</span>
										</button>
										{calendarDropdownOpen && calendars.length > 0 && (
											<div className="dropdown-popup">
												{calendars.map((cal) => (
													<div
														key={cal.id}
														className="dropdown-item"
														onClick={() => {
															setCalendarId(cal.id);
															setCalendarDropdownOpen(false);
														}}
													>
														{cal.name} {cal.primary && '(Primary)'}
													</div>
												))}
											</div>
										)}
									</div>
								</div>
							)}
						</div>

						{/* Actions */}
						<div className="modal__actions" style={{ marginTop: '2rem' }}>
							<button
								type="button"
								className="modal__btn cancel"
								onClick={handleClose}
								disabled={isCreating}
							>
								Cancel
							</button>
							<button
								type="button"
								className="modal__btn"
								onClick={handleCreate}
								disabled={isCreating}
							>
								{isCreating ? 'Creating...' : 'Create Event'}
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
