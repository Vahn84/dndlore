import React, { useEffect, useMemo, useState } from 'react';
import Modal from 'react-modal';
import { Event, Group, Page, TimeSystemConfig } from '../types';
import { useAppStore } from '../store/appStore';
import Api from '../Api';
import AssetsManagerModal from './AssetsManagerModal';
import PagePickerModal from './PagePickerModal';
import {
	Calendar,
	CalendarBlank,
	LinkBreak,
	LinkSimple,
	Trash,
} from 'phosphor-react';
import DatePicker from './DatePicker';
import { _changeIcon, ICONS } from './Icons';

interface EventModalProps {
	event: Event | null;
	groups?: Group[]; // optional: fallback to store
	timeSystem?: TimeSystemConfig; // optional: fallback to store
	onSave?: (data: Omit<Event, '_id'> & { _id?: string }) => void; // optional: fallback to store actions
	onClose: () => void;
}

// Set the root element for accessibility (required by react-modal)
Modal.setAppElement('#root');

const makeTSDefaults = (): TimeSystemConfig => ({
	name: '',
	months: [],
	weekdays: [],
	eras: [],
	hoursPerDay: 24,
	minutesPerHour: 60,
	epochWeekday: 0,
	weekdaysResetEachMonth: false,
	erasStartOnZeroYear: false,
	dateFormats: {
		year: 'YYYY [E]',
		yearMonth: 'YYYY MMMM',
		yearMonthDay: 'YYYY MMMM D',
		yearMonthDayTime: 'YYYY MMMM D HH:mm',
	},
});

const EventModal: React.FC<EventModalProps> = ({
	event,
	groups,
	timeSystem,
	onSave,
	onClose,
}) => {
	// ---- Store fallbacks ----
	const storeGroups = useAppStore((s) => s.data.groups.data);
	const storeTS = useAppStore((s) => s.data.timeSystem.data);
	const createEvent = useAppStore((s) => s.createEvent);
	const updateEvent = useAppStore((s) => s.updateEvent);

	const effectiveGroups = useMemo<Group[]>(
		() => (groups && groups.length ? groups : storeGroups),
		[groups, storeGroups]
	);
	const ts: TimeSystemConfig = useMemo(
		() => timeSystem || storeTS || makeTSDefaults(),
		[timeSystem, storeTS]
	);

	// -------- Local state for form fields --------
	const [title, setTitle] = useState(event?.title || '');
	const [groupId, setGroupId] = useState(
		event?.groupId || (effectiveGroups[0]?._id ?? '')
	);
	const [description, setDescription] = useState(event?.description || '');
	const [color, setColor] = useState(
		event?.color ||
			effectiveGroups.find(
				(g) => g._id === (event?.groupId || effectiveGroups[0]?._id)
			)?.color ||
			'#475569'
	);
	const [bannerUrl, setBannerUrl] = useState(event?.bannerUrl || '');
	const [bannerThumbUrl, setbannerThumbUrl] = useState(
		event?.bannerThumbUrl || ''
	);
	const [hidden, setHidden] = useState<boolean>(event?.hidden ?? false);

	const [assetOpen, setAssetOpen] = useState(false);
	const [pagePickerOpen, setPagePickerOpen] = useState(false);
	const [linkedPage, setLinkedPage] = useState<string | undefined>(
		event?.pageId
	);
	// Single sync flag for all three fields
	const [syncEnabled, setSyncEnabled] = useState<boolean>(
		event?.linkSync ?? false
	);

	// If the URL is absolute, use it; otherwise prefix with API base
	const resolveAssetUrl = Api.resolveAssetUrl;
	// Keep defaults in sync if `event` or lists arrive later
	useEffect(() => {
		setTitle(event?.title || '');
		setGroupId(event?.groupId || (effectiveGroups[0]?._id ?? ''));
		setDescription(event?.description || '');
		setBannerUrl(event?.bannerUrl || '');
		setbannerThumbUrl(event?.bannerThumbUrl || '');
		setHidden(event?.hidden ?? false);
		setLinkedPage(event?.pageId);
		setSyncEnabled(event?.linkSync ?? false);
		// set color from event or selected group
		if (!event || !event.color) {
			const selected = effectiveGroups.find(
				(g) => g._id === (event?.groupId || effectiveGroups[0]?._id)
			);
			if (selected?.color) setColor(selected.color);
		} else {
			setColor(event.color);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [event, effectiveGroups]);

	// -------- Date parsing/formatting helpers --------
	const parseDateString = (
		dateStr: string | undefined,
		t: TimeSystemConfig
	): { eraId: string; year: string; monthIndex: string; day: string } => {
		if (!dateStr) {
			return {
				eraId: t.eras[0]?.id ?? '',
				year: '',
				monthIndex: '',
				day: '',
			};
		}

		// Era: try to match abbreviation; fallback to first era
		let eraId = t.eras[0]?.id ?? '';
		for (const era of t.eras) {
			const abbr = era.abbreviation?.trim();
			if (!abbr) continue;
			const re = new RegExp(`(?:^|[ ,])${abbr}(?:$|[ ,])`);
			if (re.test(dateStr)) {
				eraId = era.id;
				break;
			}
		}

		// Month: detect by name (word boundary)
		let monthIndex: string = '';
		let monthIdxNum = -1;
		for (let idx = 0; idx < t.months.length; idx++) {
			const name = t.months[idx]?.name;
			if (!name) continue;
			const re = new RegExp(`\\b${name}\\b`);
			if (re.test(dateStr)) {
				monthIndex = String(idx);
				monthIdxNum = idx;
				break;
			}
		}

		// Day: only if a month was detected; capture a number following the month name
		let day = '';
		if (monthIdxNum >= 0) {
			const name = t.months[monthIdxNum].name;
			const re = new RegExp(`${name}\\s+(\\d{1,2})`);
			const m = dateStr.match(re);
			if (m) day = m[1];
		}

		// Year: choose the last number if a day is present, otherwise the first number
		let year = '';
		const nums = dateStr.match(/-?\d+/g) || [];
		if (nums.length > 0) {
			year = day ? nums[nums.length - 1] : nums[0] ? nums[0] : '0';
		}

		return { eraId, year, monthIndex, day };
	};

	const initialStart = useMemo(() => {
		if (event) {
			const parsed = parseDateString(event.startDate, ts);
			return {
				eraId: event.startEraId ?? parsed.eraId ?? ts.eras[0]?.id ?? '',
				year:
					event.startYear !== undefined
						? String(event.startYear)
						: parsed.year,
				monthIndex:
					event.startMonthIndex !== undefined &&
					event.startMonthIndex !== null
						? String(event.startMonthIndex)
						: parsed.monthIndex,
				day:
					event.startDay !== undefined && event.startDay !== null
						? String(event.startDay)
						: parsed.day,
			};
		}
		return parseDateString(undefined, ts);
	}, [event, ts]);

	const initialEnd = useMemo(() => {
		if (event) {
			const parsed = parseDateString(event.endDate, ts);
			return {
				eraId: event.endEraId ?? parsed.eraId ?? ts.eras[0]?.id ?? '',
				year:
					event.endYear !== undefined
						? String(event.endYear)
						: parsed.year,
				monthIndex:
					event.endMonthIndex !== undefined &&
					event.endMonthIndex !== null
						? String(event.endMonthIndex)
						: parsed.monthIndex,
				day:
					event.endDay !== undefined && event.endDay !== null
						? String(event.endDay)
						: parsed.day,
			};
		}

		return parseDateString(undefined, ts);
	}, [event, ts]);

	const [startEraId, setStartEraId] = useState(initialStart.eraId);
	const [startYear, setStartYear] = useState<string>(initialStart.year);
	const [startMonthIndex, setStartMonthIndex] = useState<string>(
		initialStart.monthIndex
	);
	const [startDay, setStartDay] = useState<string>(initialStart.day);

	const [endEnabled, setEndEnabled] = useState<boolean>(!!event?.endDate);
	const [endEraId, setEndEraId] = useState(initialEnd.eraId);
	const [endYear, setEndYear] = useState<string>(initialEnd.year);
	const [endMonthIndex, setEndMonthIndex] = useState<string>(
		initialEnd.monthIndex
	);
	const [endDay, setEndDay] = useState<string>(initialEnd.day);
	const [icon, setIcon] = useState<string>(event?.icon || 'calendar');

	useEffect(() => {
		setStartEraId(initialStart.eraId);
		setStartYear(initialStart.year);
		setStartMonthIndex(initialStart.monthIndex);
		setStartDay(initialStart.day);
		setEndEnabled(!!event?.endDate);
		setEndEraId(initialEnd.eraId);
		setEndYear(initialEnd.year);
		setEndMonthIndex(initialEnd.monthIndex);
		setEndDay(initialEnd.day);
		console.log('ENDERAID', initialEnd.eraId);
		console.log('STARTERAID', initialStart.eraId);
	}, [initialStart, initialEnd, event?.endDate]);

	// Ensure an era is selected once the time system is available
	useEffect(() => {
		if (ts.eras.length > 0) {
			if (!startEraId) setStartEraId(ts.eras[0].id);
			if (endEnabled && !endEraId) setEndEraId(ts.eras[0].id);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ts.eras.length, startEraId, endEraId, endEnabled]);

	const formatDateString = (
		eraId: string,
		year: string,
		monthIndex: string,
		day: string,
		format: string
	): string => {
		const era = ts.eras.find((e) => e.id === eraId) || ts.eras[0];
		const eraAbbr = era?.abbreviation ?? '';
		const eraName = era?.name ?? '';
		const monthIdxNum = monthIndex === '' ? -1 : parseInt(monthIndex, 10);
		const month = monthIdxNum >= 0 ? ts.months[monthIdxNum] : undefined;
		const monthNumber = monthIdxNum >= 0 ? monthIdxNum + 1 : undefined;
		const monthName = month?.name ?? '';
		const dayNum = day ? parseInt(day, 10) : undefined;
		const ordinal = (n: number): string => {
			const s = ['th', 'st', 'nd', 'rd'];
			const v = n % 100;
			return n + (s[(v - 20) % 10] || s[v] || s[0]);
		};

		const tokenRE = /(D\^|DD|D|YYYY|YY|MMMM|MM|M|EE|E)/g;
		let out = format.replace(tokenRE, (token) => {
			switch (token) {
				case 'EE':
					return eraName;
				case 'E':
					return eraAbbr;
				case 'YYYY':
					return year;
				case 'YY':
					return year.slice(-2);
				case 'MMMM':
					return month ? monthName : '';
				case 'MM':
					return month && monthNumber !== undefined
						? monthNumber.toString().padStart(2, '0')
						: '';
				case 'M':
					return month && monthNumber !== undefined
						? String(monthNumber)
						: '';
				case 'D^':
					return dayNum !== undefined ? ordinal(dayNum) : '';
				case 'DD':
					return dayNum !== undefined
						? dayNum.toString().padStart(2, '0')
						: '';
				case 'D':
					return dayNum !== undefined ? String(dayNum) : '';
				default:
					return token;
			}
		});

		out = out
			.replace(/\s+,/g, ',')
			.replace(/,\s*,/g, ',')
			.replace(/\s{2,}/g, ' ')
			.replace(/,\s*$/g, '')
			.trim();

		return out;
	};

	// Update color when group changes (if event has no custom color)
	useEffect(() => {
		if (!event || !event.color) {
			const selected = effectiveGroups.find((g) => g._id === groupId);
			if (selected?.color) setColor(selected.color);
		}
	}, [groupId, event, effectiveGroups]);

	// Apply defaults from a linked page (title, banner, world date)
	const applyLinkedPageDefaults = (p: Page) => {
		// Title: fill if empty
		if (!title || title.trim().length === 0) {
			setTitle(p.title || 'Event');
		}
		// Banner: fill if empty
		if ((!bannerUrl || bannerUrl.trim().length === 0) && p.bannerUrl) {
			setBannerUrl(p.bannerUrl);
		}
		if (
			(!bannerThumbUrl || bannerThumbUrl.trim().length === 0) &&
			p.bannerThumbUrl
		) {
			setbannerThumbUrl(p.bannerThumbUrl);
		}
		// World date: if present, set start date parts
		if (p.worldDate) {
			setStartEraId(p.worldDate.eraId || startEraId);
			setStartYear(String(p.worldDate.year ?? startYear ?? ''));
			setStartMonthIndex(
				p.worldDate.monthIndex !== undefined &&
					p.worldDate.monthIndex !== null
					? String(p.worldDate.monthIndex)
					: startMonthIndex
			);
			setStartDay(
				p.worldDate.day !== undefined && p.worldDate.day !== null
					? String(p.worldDate.day)
					: startDay
			);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		let formattedStart = '';
		let formattedEnd: string | undefined = undefined;
		const sYear = startYear.trim();
		if (sYear !== '') {
			if (startMonthIndex === '') {
				formattedStart = formatDateString(
					startEraId,
					sYear,
					'',
					'',
					ts.dateFormats.year
				);
			} else {
				if (startDay !== '') {
					formattedStart = formatDateString(
						startEraId,
						sYear,
						startMonthIndex,
						startDay,
						ts.dateFormats.yearMonthDay
					);
				} else {
					formattedStart = formatDateString(
						startEraId,
						sYear,
						startMonthIndex,
						'',
						ts.dateFormats.yearMonth
					);
				}
			}
		}
		if (endEnabled) {
			const eYear = endYear.trim();
			if (eYear !== '') {
				if (endMonthIndex === '') {
					formattedEnd = formatDateString(
						endEraId,
						eYear,
						'',
						'',
						ts.dateFormats.year
					);
				} else {
					if (endDay !== '') {
						formattedEnd = formatDateString(
							endEraId,
							eYear,
							endMonthIndex,
							endDay,
							ts.dateFormats.yearMonthDay
						);
					} else {
						formattedEnd = formatDateString(
							endEraId,
							eYear,
							endMonthIndex,
							'',
							ts.dateFormats.yearMonth
						);
					}
				}
			}
		}

		const clearingEnd = !!event?.endDate && !endEnabled;

		const payload: any = {
			_id: event?._id,
			groupId,
			title,
			detailLevel: 'Year',
			icon,
			// formatted strings (for display/search)
			startDate: formattedStart || undefined,
			// structured fields (for reliable re-hydration)
			startEraId: startEraId || undefined,
			startYear: sYear ? parseInt(sYear, 10) : undefined,
			startMonthIndex:
				startMonthIndex !== ''
					? parseInt(startMonthIndex, 10)
					: undefined,
			startDay: startDay !== '' ? parseInt(startDay, 10) : undefined,
			description,
			bannerUrl: bannerUrl || undefined,
			bannerThumbUrl: bannerThumbUrl || undefined,
			color,
			hidden,
			pageId: linkedPage || undefined,
			linkSync: !!syncEnabled,
		};

		if (endEnabled) {
			// send composed end date
			payload.endDate = formattedEnd;
			payload.endEraId = endEraId || undefined;
			payload.endYear = endYear.trim()
				? parseInt(endYear.trim(), 10)
				: undefined;
			payload.endMonthIndex =
				endMonthIndex !== '' ? parseInt(endMonthIndex, 10) : undefined;
			payload.endDay = endDay !== '' ? parseInt(endDay, 10) : undefined;
		} else if (clearingEnd) {
			// explicitly clear end date on the server
			payload.endDate = null;
			payload.endEraId = null;
			payload.endYear = null;
			payload.endMonthIndex = null;
			payload.endDay = null;
		}

		try {
			if (onSave) {
				onSave(payload);
			} else {
				if (payload._id) {
					const { _id, ...rest } = payload as any;
					await updateEvent({
						_id: _id,
						...(rest as Partial<Event>),
					});
				} else {
					const { _id, ...rest } = payload as any;
					await createEvent(rest as Omit<Event, '_id'>);
				}
			}
			onClose();
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Failed to save event', err);
		}
	};

	const resolveIcon = (icon: string): React.ReactNode => {
		return ICONS[icon] || <CalendarBlank />;
	};

	const changeIcon = () => {
		setIcon(_changeIcon(icon));
	};

	return (
		<>
			<Modal
				isOpen={true}
				onRequestClose={onClose}
				contentLabel="Event Editor"
				className="modal__content modal__content--event event-modal"
				overlayClassName="modal__overlay"
			>
				<div className="modal__body">
					<div className="modal__body_content">
						<form onSubmit={handleSubmit}>
							<div style={{ position: 'relative' }}>
								<div
									className="bannerPreview"
									style={{
										backgroundImage: `${
											bannerUrl && bannerUrl.length > 0
												? 'url(' +
												  resolveAssetUrl(bannerUrl) +
												  ')'
												: ''
										}`,
									}}
								>
									{bannerUrl && bannerUrl.length > 0 && (
										<button
											style={{
												position: 'absolute',
												right: '10px',
												top: '10px',
											}}
											className="trash-btn"
											type="button"
											onClick={() => setBannerUrl('')}
											title="Delete month"
										>
											<Trash color="white" />
										</button>
									)}
									{!bannerUrl && (
										<div className="modal__assets_manager">
											<button
												type="button"
												onClick={() =>
													setAssetOpen(true)
												}
											>
												Add Image
											</button>
										</div>
									)}
									{/* Title */}
									<div className="modal__title_wrapper">
										<span
											className="icon_square-btn"
											onClick={changeIcon}
										>
											{resolveIcon(icon)}
										</span>
										<input
											type="text"
											value={title}
											onChange={(e) =>
												setTitle(e.target.value)
											}
											className="modal__input"
											placeholder="Set the Event Title"
											required
										/>
									</div>
								</div>
							</div>

							<div className="modal__form_wrapper">
								{/* Link section */}
								<fieldset
									style={{
										border: 'none',
										padding: 0,
										margin: '0 0 1rem 0',
									}}
								>
									<div
										style={{
											display: 'flex',
											gap: '0.5rem',
											alignItems: 'center',
											flexWrap: 'wrap',
										}}
									>
										{linkedPage ? (
											<>
												<button
													type="button"
													className="btn-muted"
													onClick={() => {
														setLinkedPage(
															undefined
														);
														setSyncEnabled(false);
													}}
													style={{
														padding: '0.75rem',
														fontSize: '0.85rem',
														display: 'flex',
														alignItems: 'center',
														justifyContent:
															'center',
													}}
												>
													<LinkBreak
														size={16}
														style={{
															marginRight:
																'0.25rem',
														}}
													/>
													<span>Unlink Page</span>
												</button>
											</>
										) : (
											<button
												type="button"
												className="btn-primary"
												onClick={() =>
													setPagePickerOpen(true)
												}
												style={{
													padding: '0.75rem',
													fontSize: '0.85rem',
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
												}}
											>
												<LinkSimple
													size={16}
													style={{
														marginRight: '0.25rem',
													}}
												/>
												<span>Link Page</span>
											</button>
										)}
									</div>

									{/* Sync checkbox - only shown when linked */}
									{linkedPage && (
										<div
											className="checkbox-wrapper"
											style={{ marginTop: '0.75rem' }}
										>
											<input
												type="checkbox"
												id="sync-checkbox"
												className="input-checkbox input-checkbox-light"
												checked={syncEnabled}
												onChange={(e) =>
													setSyncEnabled(
														e.target.checked
													)
												}
											/>
											<label
												className="input-checkbox-btn"
												htmlFor="sync-checkbox"
											/>
											<span
												className="form-label"
												style={{ fontSize: '0.9rem' }}
											>
												Keep synced (title, banner,
												world date)
											</span>
										</div>
									)}
								</fieldset>

								{/* Group selection */}
								<fieldset
									style={{
										border: 'none',
										padding: 0,
										margin: 0,
									}}
								>
									<div
										style={{
											display: 'flex',
											gap: '0.5rem',
											flexWrap: 'wrap',
										}}
									>
										<div style={{ flex: '65%' }}>
											<label className="form-label">
												Group
												<select
													value={groupId}
													onChange={(e) =>
														setGroupId(
															e.target.value
														)
													}
													className="modal__select"
												>
													{[...effectiveGroups]
														.sort(
															(a, b) =>
																(a.order ?? 0) -
																(b.order ?? 0)
														)
														.map((g) => (
															<option
																key={g._id}
																value={g._id}
																style={{
																	color: g.color,
																}}
															>
																{g.name}
															</option>
														))}
												</select>
											</label>
										</div>
										{/* Color picker */}
										<div style={{ flex: '30%' }}>
											<label
												className="form-label color-picker"
												style={{}}
											>
												Color
												<input
													type="color"
													value={color}
													onChange={(e) =>
														setColor(e.target.value)
													}
													className="form-input"
												/>
											</label>
										</div>
									</div>
								</fieldset>

								{/* Start date selectors */}

								<DatePicker
									ts={timeSystem} // your TimeSystemConfig
									label="Start"
									value={{
										eraId: startEraId,
										year: startYear,
										monthIndex: startMonthIndex || '0',
										day: startDay || '1',
									}}
									onChange={(parts) => {
										if (!parts) return; // Start required
										setStartEraId(parts.eraId);
										setStartYear(parts.year);
										setStartMonthIndex(parts.monthIndex);
										setStartDay(parts.day);
									}}
								/>
								<DatePicker
									ts={timeSystem}
									label="End"
									placeholder="Pick a date (optional)"
									clearable
									value={{
										eraId: endEraId,
										year: endYear,
										monthIndex: endMonthIndex || '0',
										day: endDay || '1',
									}}
									onChange={(parts) => {
										if (!parts) {
											setEndEnabled(false);
											setEndEraId(
												timeSystem?.eras[0]?.id || ''
											);
											setEndYear('');
											setEndMonthIndex('');
											setEndDay('');
											return;
										}
										setEndEraId(parts.eraId);
										setEndYear(parts.year);
										setEndMonthIndex(parts.monthIndex);
										setEndDay(parts.day);
										// Enable end date when any meaningful part is present
										const hasAny = Boolean(
											(parts.year && parts.year.trim()) ||
												(parts.monthIndex &&
													parts.monthIndex.trim()) ||
												(parts.day && parts.day.trim())
										);
										setEndEnabled(hasAny);
									}}
								/>

								<div className="checkbox-wrapper">
									<input
										className="input-checkbox input-checkbox-light"
										type="checkbox"
										id="hidden-checkbox"
										checked={hidden}
										onChange={(e) => {
											setHidden(e.target.checked);
											console.log(
												'HIDDEN',
												e.target.checked
											);
										}}
									/>

									<label
										className="input-checkbox-btn"
										htmlFor="hidden-checkbox"
									></label>
									<span className="form-label">
										Hidden (DM only)
									</span>
								</div>

								<div
									style={{
										display: 'flex',
										justifyContent: 'flex-end',
										gap: '0.5rem',
										marginTop: '1rem',
									}}
								>
									<button
										type="button"
										onClick={onClose}
										className="btn-muted"
									>
										Cancel
									</button>
									<button
										type="submit"
										className="btn-primary"
									>
										{event ? 'Update' : 'Create'}
									</button>
								</div>
							</div>
						</form>
					</div>
				</div>
			</Modal>
			<AssetsManagerModal
				isOpen={assetOpen}
				onClose={() => setAssetOpen(false)}
				onSelect={(asset) => {
					setBannerUrl(asset.url);
					setbannerThumbUrl(asset.thumb_url || '');
					setAssetOpen(false);
				}}
			/>
			<PagePickerModal
				isOpen={pagePickerOpen}
				onClose={() => setPagePickerOpen(false)}
				onSelect={async (page) => {
					setLinkedPage(page._id);
					// default enable sync when linking
					setSyncEnabled(true);
					// fetch full page details to ensure worldDate/banner are present
					try {
						const full = await Api.getPage(page._id);
						applyLinkedPageDefaults(full as Page);
					} catch (e) {
						// fallback to the item we already have
						applyLinkedPageDefaults(page as Page);
					}
				}}
				placeholder="Search pages..."
				filterTypes={['history', 'campaign']}
			/>
		</>
	);
};

export default EventModal;
