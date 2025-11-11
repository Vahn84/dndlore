import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DetailLevel, Event, Group, TimeSystemConfig } from '../types';
import '../styles/Timeline.scss';
import TimeSystemModal from './TimeSystemModal';
import GroupModal from './GroupModal';
import EventModal from './EventModal';
import { useAppStore } from '../store/appStore';
import { Virtuoso } from 'react-virtuoso';
import { ICONS } from './Icons';
import { CalendarBlank } from 'phosphor-react';
import Api from '../Api';

interface TimelineProps {}

const Timeline: React.FC<TimelineProps> = () => {
	const navigate = useNavigate();
	// Modals control
	const [isEventModalOpen, setEventModalOpen] = useState(false);
	const [editingEvent, setEditingEvent] = useState<Event | null>(null);
	const [isGroupModalOpen, setGroupModalOpen] = useState(false);
	const [isTimeSystemModalOpen, setTimeSystemModalOpen] = useState(false);
	// Context menu & per-event view state
	const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
	// Refs for the currently open menu (only one menu can be open)
	const menuRootRef = useRef<HTMLDivElement | null>(null);
	const menuButtonRef = useRef<HTMLButtonElement | null>(null);
	// Measure first rendered item to tune overscan
	const firstItemRef = useRef<HTMLDivElement | null>(null);
	const [overscan, setOverscan] = useState<{ top: number; bottom: number }>({
		top: 600,
		bottom: 800,
	});

	// Dynamically compute overscan based on viewport & average item height
	useEffect(() => {
		const compute = () => {
			const vh =
				typeof window !== 'undefined' ? window.innerHeight || 800 : 800;
			const itemH =
				firstItemRef.current?.getBoundingClientRect().height || 260; // sensible default
			// Keep ~1 viewport worth OR ~6 items worth buffered (whichever is larger)
			const buffer = Math.max(
				Math.round(vh * 0.9),
				Math.round(itemH * 6)
			);
			setOverscan({ top: buffer, bottom: buffer });
		};
		compute();
		// Recompute on resize and when the first item resizes
		let ro: ResizeObserver | undefined;
		if (typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver(() => compute());
			if (firstItemRef.current) ro.observe(firstItemRef.current);
		}
		window.addEventListener('resize', compute);
		return () => {
			window.removeEventListener('resize', compute);
			if (ro) ro.disconnect();
		};
	}, []);
	// Close menu on outside click or ESC
	useEffect(() => {
		if (!menuOpenFor) return;
		const onPointerDown = (e: MouseEvent | TouchEvent) => {
			const target = e.target as Node;
			if (menuRootRef.current && menuRootRef.current.contains(target))
				return;
			if (menuButtonRef.current && menuButtonRef.current.contains(target))
				return;
			setMenuOpenFor(null);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setMenuOpenFor(null);
		};
		document.addEventListener('mousedown', onPointerDown, true);
		document.addEventListener('touchstart', onPointerDown, true);
		document.addEventListener('keydown', onKey, true);
		return () => {
			document.removeEventListener('mousedown', onPointerDown, true);
			document.removeEventListener('touchstart', onPointerDown, true);
			document.removeEventListener('keydown', onKey, true);
		};
	}, [menuOpenFor]);

	const groups = useAppStore((s) => s.data.groups.data);
	const _events = useAppStore((s) => s.data.events.data);
	const activeGroupIds = useAppStore((s) => s.ui.activeGroupIds);
	const showHidden = useAppStore((s) => s.ui.showHidden);
	const timeSystem = useAppStore((s) => s.data.timeSystem.data);
	const isDM = useAppStore((s) => s.isDM());

	const createEvent = useAppStore((s) => s.createEvent);
	const updateEvent = useAppStore((s) => s.updateEvent);
	const deleteEvent = useAppStore((s) => s.deleteEvent);

	const saveTimeSystem = useAppStore((s) => s.saveTimeSystem);
	const setGroupsFilter = useAppStore((s) => s.setGroupsFilter);
	const setShowHidden = useAppStore((s) => s.setShowHidden);

	// Build a numeric sort key from the event's start date (Year, Month, Day)
	const buildSortKey = (ev: Event): number => {
		const escapeReg = (s: string) =>
			s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		// 1) Year
		let year = parseYear(ev.startDate);
		if (!year) {
			const sy = (ev as any).startYear;
			if (typeof sy === 'number') year = sy;
			else if (typeof sy === 'string' && /^\d+$/.test(sy))
				year = Number(sy);
		}
		// 2) Month
		let month = 0;
		if (typeof ev.startMonthIndex === 'number') {
			month = (ev.startMonthIndex as number) + 1; // 1..N
		} else if (ev.startDate && timeSystem?.months?.length) {
			const idx = timeSystem.months.findIndex((m: any) =>
				new RegExp(`\\b${escapeReg(m.name)}\\b`, 'i').test(
					ev.startDate as string
				)
			);
			if (idx >= 0) month = idx + 1;
		}
		// 3) Day
		let day = 0;
		if (typeof ev.startDay === 'number') day = ev.startDay as number;
		else if (ev.startDate) {
			const m = (ev.startDate as string).match(
				/^(\d+)(?:st|nd|rd|th)?\b/i
			);
			if (m) day = Number(m[1]);
		}
		// Compose as YYYYMMDD to sort chronologically. Missing parts become 0.
		return (year || 0) * 10000 + month * 100 + day;
	};

	const orderedEvents = _events
		.filter((e) =>
			activeGroupIds.length ? activeGroupIds.includes(e.groupId) : false
		)
		.filter((e) => (showHidden ? true : !e.hidden))
		.sort((a, b) => {
			const kb = buildSortKey(b);
			const ka = buildSortKey(a);
			if (kb !== ka) return kb - ka; // DESC by date (newest/largest first)
			return (a.order ?? 0) - (b.order ?? 0); // tie-breaker: explicit order
		});
	// Final, visible list for rendering (virtualized)
	const visibleEvents = orderedEvents.filter((e) =>
		activeGroupIds.length ? activeGroupIds.includes(e.groupId) : true
	);

	// --- Helpers to ensure startDate/endDate strings exist when saving ---
	const ordinal = (n: number) => {
		const mod100 = n % 100;
		if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
		switch (n % 10) {
			case 1:
				return `${n}st`;
			case 2:
				return `${n}nd`;
			case 3:
				return `${n}rd`;
			default:
				return `${n}th`;
		}
	};

	const pickYearFrom = (
		obj: any,
		prefix: 'start' | 'end'
	): number | undefined => {
		const candidates = [
			`${prefix}Year`,
			`${prefix}DateYear`,
			`${prefix}_year`,
			`${prefix}_date_year`,
			'year',
		];
		for (const key of candidates) {
			const v = obj?.[key];
			if (typeof v === 'number' && Number.isFinite(v)) return v;
			if (typeof v === 'string' && v.trim() && /^\d+$/.test(v.trim()))
				return Number(v.trim());
		}
		return undefined;
	};

	const composeDate = (
		prefix: 'start' | 'end',
		ev: any
	): string | undefined => {
		const explicit = ev?.[`${prefix}Date`];
		if (explicit && typeof explicit === 'string' && explicit.trim())
			return explicit.trim();

		const year = pickYearFrom(ev, prefix);
		if (year == null) return undefined;

		const monthIndex = ev?.[`${prefix}MonthIndex`];
		const day = ev?.[`${prefix}Day`];
		const eraId = ev?.[`${prefix}EraId`];

		const monthName: string | undefined =
			typeof monthIndex === 'number'
				? timeSystem?.months?.[monthIndex]?.name ||
				  `Month ${monthIndex + 1}`
				: undefined;
		const eraCode: string | undefined = eraId
			? timeSystem?.eras?.find((e: any) => e._id === eraId)?.code ||
			  timeSystem?.eras?.find((e: any) => e._id === eraId)?.name
			: undefined;

		if (typeof day === 'number' && monthName) {
			return `${ordinal(day)} ${monthName} ${String(year)}${
				eraCode ? `, ${eraCode}` : ''
			}`;
		}
		if (monthName) {
			return `${monthName} ${String(year)}${
				eraCode ? `, ${eraCode}` : ''
			}`;
		}
		return `${String(year)}${eraCode ? `, ${eraCode}` : ''}`;
	};

	const ensureEventDates = (ev: any) => {
		const next = { ...ev };
		if (!next.startDate) {
			const s = composeDate('start', next);
			if (s) next.startDate = s;
		}
		// Only try to build endDate if end parts exist and endDate is missing
		const hasEndParts =
			next.endDate ||
			typeof next.endDay !== 'undefined' ||
			typeof next.endMonthIndex !== 'undefined' ||
			typeof next.endEraId !== 'undefined' ||
			typeof (next as any).endYear !== 'undefined' ||
			typeof (next as any).end_date_year !== 'undefined';
		if (!next.endDate && hasEndParts) {
			const e = composeDate('end', next);
			if (e) next.endDate = e;
		}
		return next;
	};

	// Create or update an event
	const handleSaveEvent = async (
		data: Omit<Event, '_id'> & { _id?: string }
	) => {
		try {
			const base = editingEvent
				? { ...editingEvent, ...data }
				: { ...data };
			const payload = ensureEventDates(base);
			if (!payload.startDate) {
				console.error(
					'Missing startDate. Ensure at least a year (and optionally month/day) is selected.'
				);
				// Early return to avoid 400s from the backend
				return;
			}
			if (payload._id) {
				await updateEvent({ ...payload, _id: payload._id });
			} else {
				await createEvent(payload as Omit<Event, 'id'>);
			}
		} catch (err) {
			console.error('Failed to save event', err);
		} finally {
			setEventModalOpen(false);
			setEditingEvent(null);
		}
	};

	// Save time system via the API
	const handleSaveTimeSystem = async (data: TimeSystemConfig) => {
		try {
			await saveTimeSystem(data);
		} catch (err) {
			console.error('Failed to save time system', err);
		} finally {
			setTimeSystemModalOpen(false);
		}
	};

	// Toggle group filter
	const toggleGroupFilter = (id: string) => {
		const next = activeGroupIds.includes(id)
			? activeGroupIds.filter((g) => g !== id)
			: [...activeGroupIds, id];
		setGroupsFilter(next);
	};
	// Helper to parse year from startDate string (tolerant of undefined)
	function parseYear(str?: string | null): number {
		if (!str) return 0;
		const all = str.match(/(\d{1,6})(?!.*\d)/); // last number is the year
		return all ? parseInt(all[1], 10) : 0;
	}

	// Format any date string according to a chosen detail level.
	const formatDateLeft = (dateStr?: string, level: DetailLevel = 'Year') => {
		if (!dateStr) return '';
		const prettifyYear = (s: string) => s;

		const ordinal = (n: number) => {
			const mod100 = n % 100;
			if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
			switch (n % 10) {
				case 1:
					return `${n}st`;
				case 2:
					return `${n}nd`;
				case 3:
					return `${n}rd`;
				default:
					return `${n}th`;
			}
		};

		// 1) Ordinal + Month + Year (e.g., "1st Primos 10000, DE")
		const ordinalMonthYear = dateStr.match(
			/(\d+)(?:st|nd|rd|th)?\s+([A-Za-zÀ-ÖØ-öø-ÿ']+)\s+(\d{1,6})(?:,\s*([A-Z]{1,3}))?/
		);
		if (ordinalMonthYear) {
			const day = Number(ordinalMonthYear[1]);
			const monthName = ordinalMonthYear[2];
			const year = Number(ordinalMonthYear[3]);
			const era = ordinalMonthYear[4];
			switch (level) {
				case 'Day':
					return `${ordinal(day)} ${monthName} ${String(year)}${
						era ? `, ${era}` : ''
					}`;
				case 'Month':
					return `${monthName} ${String(year)}${
						era ? `, ${era}` : ''
					}`;
				case 'Year':
				default:
					return `${String(year)}${era ? `, ${era}` : ''}`;
			}
		}

		// 2) Month + Year (e.g., "Primos 10000, DE")
		const monthYear = dateStr.match(
			/([A-Za-zÀ-ÖØ-öø-ÿ']+)\s+(\d{1,6})(?:,\s*([A-Z]{1,3}))?/
		);
		if (monthYear) {
			const monthName = monthYear[1];
			const year = Number(monthYear[2]);
			const era = monthYear[3];
			switch (level) {
				case 'Month':
					return `${monthName} ${String(year)}${
						era ? `, ${era}` : ''
					}`;
				case 'Year':
				default:
					return `${String(year)}${era ? `, ${era}` : ''}`;
			}
		}

		// 3) Strict ISO-like ONLY (e.g., "10000-01-01" or "10000") – must match the whole string
		const iso = dateStr.match(
			/^(\d{1,6})(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?)?(?:[ T](\d{1,2}):(\d{2}))?$/
		);
		if (iso) {
			const year = Number(iso[1]);
			const month = iso[2] ? Number(iso[2]) : undefined;
			const day = iso[3] ? Number(iso[3]) : undefined;
			const monthNames = [
				'Jan',
				'Feb',
				'Mar',
				'Apr',
				'May',
				'Jun',
				'Jul',
				'Aug',
				'Sep',
				'Oct',
				'Nov',
				'Dec',
			];
			switch (level) {
				case 'Day':
					if (month && day)
						return `${ordinal(day)} ${
							monthNames[(month - 1) % 12]
						} ${String(year)}`;
				// fallthrough
				case 'Month':
					if (month)
						return `${monthNames[(month - 1) % 12]} ${String(
							year
						)}`;
				// fallthrough
				case 'Year':
				default:
					return String(year);
			}
		}
		// 4) Fallback: try to keep ERA if present (e.g., "10000, DE")
		const lastNumber = dateStr.match(/(\d{1,6})(?!.*\d)/);
		const eraMatch = dateStr.match(/,\s*([A-Z]{1,3})\b/);
		if (lastNumber) {
			const year = Number(lastNumber[1]);
			const era = eraMatch ? eraMatch[1] : undefined;
			return `${String(year)}${era ? `, ${era}` : ''}`;
		}

		return prettifyYear(dateStr);
	};

	const setDetailLevelFor = async (ev: Event, level: DetailLevel) => {
		try {
			await updateEvent({ ...ev, detailLevel: level });
		} catch (err) {
			console.error('Failed to set detail level', err);
		} finally {
			setMenuOpenFor(null);
		}
	};

	const handleDuplicateEvent = async (ev: Event) => {
		try {
			await createEvent({
				title: `${ev.title} (Copy)`,
				startDate: ev.startDate,
				endDate: ev.endDate,
				startDay: ev.startDay,
				endDay: ev.endDay,
				startMonthIndex: ev.startMonthIndex,
				endMonthIndex: ev.endMonthIndex,
				startEraId: ev.startEraId,
				endEraId: ev.endEraId,
				description: ev.description,
				groupId: ev.groupId,
				icon: ev.icon,
				color: (ev as any).color,
				bannerUrl: (ev as any).bannerUrl,
				hidden: ev.hidden,
				order: (ev.order ?? 0) + 0.01,
				detailLevel: ev.detailLevel || 'Year',
			} as unknown as Omit<Event, '_id'>);
		} catch (err) {
			console.error('Failed to duplicate event', err);
		} finally {
			setMenuOpenFor(null);
		}
	};

	const handleMoveToGroup = async (ev: Event, groupId: string) => {
		try {
			await updateEvent({ ...ev, groupId });
		} catch (err) {
			console.error('Failed to move event', err);
		} finally {
			setMenuOpenFor(null);
		}
	};

	const handleDeleteEvent = async (id: string) => {
		try {
			await deleteEvent(id);
		} catch (err) {
			console.error('Failed to delete event', err);
		} finally {
			setMenuOpenFor(null);
		}
	};

	const resolveIcon = (icon?: string): React.ReactNode => {
		if (icon) {
			return ICONS[icon] || <CalendarBlank />;
		} else {
			return <CalendarBlank />;
		}
	};

	const renderEvent = (ev: Event, index: number) => {
		// compute difference from previous event for caption
		const prev = index > 0 ? visibleEvents[index - 1] : null;
		let diffLabel = '';
		if (prev) {
			const prevYear = parseYear(prev.startDate);
			const currYear = parseYear(ev.startDate);
			if (prevYear > 0 && currYear > 0) {
				const diff = prevYear - currYear;
				if (diff > 0) {
					diffLabel = `${diff.toLocaleString()} years later`;
				}
			}
		}
		const group = groups.find((g) => g._id === ev.groupId);
		function onEditEvent(ev: Event): void {
			setEditingEvent(ev);
			setEventModalOpen(true);
		}

		// helper to open linked page if present
		const openLinkedPage = async (pageId?: string) => {
			if (!pageId) return;
			try {
				const page = await Api.getPage(pageId);
				if (page && page._id && page.type) {
					navigate(`/lore/${page.type}/${page._id}`, {
						state: { from: 'timeline' },
					});
				}
			} catch (e) {
				console.error('Failed to open linked page', e);
			}
		};

		// event card style
		// Compose a card that splits into info and image sections. The card uses a
		// dark translucent background and rounded corners. The group name is
		// displayed as a pill at the top of the info section. If a banner image
		// exists it will occupy the right side of the card.
		return (
			<div
				ref={index === 0 ? firstItemRef : undefined}
				className="timeline-event-wrapper"
			>
				<div
					key={ev._id}
					className="event"
					style={
						{
							'--group-color': group?.color || '#475569',
						} as React.CSSProperties
					}
				>
					{/* vertical line to next event (except last) */}

					<div className="row">
						{/* Date and difference column */}
						<div className="date">
							<div className="detailLevel">
								{formatDateLeft(
									ev.startDate,
									(ev as any).detailLevel || 'Year'
								)}
							</div>
							{diffLabel && (
								<div className="diff">{diffLabel}</div>
							)}
						</div>
						{/* Triangle marker (diamond) */}
						<div className="marker">
							<div className="diamond">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="31"
									height="30"
									viewBox="0 0 31 30"
									fill="none"
								>
									<path
										d="M29.793 15L15.5 29.293L1.20703 15L15.5 0.707031L29.793 15Z"
										fill="#27272A"
										fill-opacity="0.8"
										stroke="rgba(115,107,1,1)"
									></path>
								</svg>
								<div className="diamond-line"></div>
							</div>
						</div>
						{/* Event card */}
						<div className="cardWrapper">
							<div
								className={`card ${
									ev.pageId ? 'clickable' : ''
								}`}
								onClick={(e) => {
									// Only navigate if clicking the card itself, not buttons
									if (
										ev.pageId &&
										e.target === e.currentTarget
									) {
										openLinkedPage(ev.pageId);
									}
								}}
								style={{
									cursor: ev.pageId ? 'pointer' : 'default',
								}}
							>
								<div
									className="cardBg"
									style={
										ev.bannerUrl
											? {
													backgroundImage: `url(${
														process.env
															.REACT_APP_API_BASE_URL +
														(ev.bannerThumbUrl ||
															ev.bannerUrl)
													})`,
											  }
											: ev.color
											? { background: ev.color }
											: {}
									}
									onClick={(e) => {
										if (ev.pageId) {
											e.stopPropagation();
											openLinkedPage(ev.pageId);
										}
									}}
								></div>
								<div
									className="info"
									onClick={(e) => {
										// Make clicking anywhere in info area navigate (except buttons)
										if (ev.pageId && !e.defaultPrevented) {
											openLinkedPage(ev.pageId);
										}
									}}
								>
									{/* Group label */}
									<span className="groupLabel">
										{group?.name?.toUpperCase() || 'Group'}
									</span>

									<div className="title_wrapper">
										<span className="icon_square-btn">
											{resolveIcon(ev.icon)}
										</span>
										<div className="title_subtitle_wrapper">
											<h3 className="title">
												{ev.title}
											</h3>
											<div className="subtitle">
												{formatDateLeft(
													ev.startDate,
													(ev as any).detailLevel ||
														'Year'
												)}
												{ev.endDate
													? ` → ${formatDateLeft(
															ev.endDate,
															(ev as any)
																.detailLevel ||
																'Year'
													  )}`
													: ''}
											</div>
										</div>

										{ev.description && (
											<p className="description">
												{ev.description.length > 200
													? `${ev.description.slice(
															0,
															200
													  )}…`
													: ev.description}
											</p>
										)}
									</div>
									<div className="editRow">
										<button
											ref={
												menuOpenFor === ev._id
													? menuButtonRef
													: undefined
											}
											className="menuButton"
											aria-haspopup="menu"
											aria-expanded={
												menuOpenFor === ev._id
											}
											onClick={(e) => {
												e.stopPropagation();
												e.preventDefault();
												setMenuOpenFor(
													menuOpenFor === ev._id
														? null
														: ev._id
												);
											}}
										>
											⋮
										</button>

										<div
											ref={
												menuOpenFor === ev._id
													? menuRootRef
													: undefined
											}
											className={`contextMenu ${
												menuOpenFor === ev._id
													? 'open'
													: ''
											}`}
											role="menu"
											onClick={(e) => {
												e.stopPropagation();
												e.preventDefault();
											}}
										>
											<div
												className="menuItem"
												role="menuitem"
												onClick={(e) => {
													e.stopPropagation();
													onEditEvent(ev);
												}}
											>
												Edit event
											</div>
											<div
												className="menuItem"
												role="menuitem"
												onClick={(e) => {
													e.stopPropagation();
													handleDuplicateEvent(ev);
												}}
											>
												Duplicate event
											</div>
											<div
												className="menuItem submenu"
												role="menuitem"
											>
												Move to group
												<div className="submenu-list">
													{groups.map((g) => (
														<div
															key={g._id}
															className="menuItem"
															onClick={(e) => {
																e.stopPropagation();
																handleMoveToGroup(
																	ev,
																	g._id
																);
															}}
														>
															{g.name}
															{g._id ===
															ev.groupId
																? ' •'
																: ''}
														</div>
													))}
												</div>
											</div>
											<div
												className="menuItem submenu"
												role="menuitem"
											>
												Detail level
												<div className="submenu-list">
													{(
														[
															'Year',
															'Month',
															'Day',
														] as DetailLevel[]
													).map((lvl) => (
														<div
															key={lvl}
															className="menuItem"
															onClick={(e) => {
																e.stopPropagation();
																setDetailLevelFor(
																	ev,
																	lvl
																);
															}}
														>
															{((ev as any)
																.detailLevel ||
																'Year') === lvl
																? '● '
																: '○ '}
															{lvl}
														</div>
													))}
												</div>
											</div>
											<div className="separator"></div>
											<div
												className="menuItem"
												role="menuitem"
												onClick={(e) => {
													e.stopPropagation();
													handleDeleteEvent(ev._id);
												}}
											>
												Delete event
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="timeline offset-container">
			{' '}
			{/* Header with actions (not including nav) */}
			<header className="timelineHeader">
				<div className="groupFilter">
					{[...groups]
						.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
						.map((group) => (
							<button
								key={group._id}
								className={`pill ${
									activeGroupIds.includes(group._id)
										? 'active'
										: ''
								}`}
								style={{
									background: activeGroupIds.includes(
										group._id
									)
										? group.color
										: 'transparent',
									color: !activeGroupIds.includes(group._id)
										? group.color
										: '',
									borderColor: !activeGroupIds.includes(
										group._id
									)
										? group.color
										: '',
								}}
								onClick={() => toggleGroupFilter(group._id)}
							>
								{group.name.toUpperCase()}
							</button>
						))}
				</div>
				{/* Show hidden toggle with icon */}
				{isDM && (
					<div className="toolbox">
						<button
							className="toolboxButton rounded-button"
							onClick={() => setGroupModalOpen(!isGroupModalOpen)}
						>
							<i className={`icon icli iconly-Category`}></i>
							<span className="text">GROUPS</span>
						</button>
						<button
							className="toolboxButton rounded-button"
							onClick={() =>
								setTimeSystemModalOpen(!isTimeSystemModalOpen)
							}
						>
							<i className={`icon icli iconly-Calendar`}></i>
							<span className="text">TIME SYSTEM</span>
						</button>

						<button
							className="toolboxButton rounded-button"
							onClick={() => setShowHidden(!showHidden)}
						>
							<i
								className={`icon icli ${
									showHidden ? 'iconly-Hide ' : 'iconly-Show'
								}`}
							></i>
							<span className="text">
								{showHidden ? 'HIDE HIDDEN' : 'SHOW HIDDEN'}
							</span>
						</button>
					</div>
				)}
			</header>
			<div className="timeline-wrapper">
				<Virtuoso
					useWindowScroll
					data={visibleEvents}
					itemContent={(index, ev) => renderEvent(ev, index)}
					increaseViewportBy={overscan}
					className="virtuoso-timeline"
				/>
			</div>
			{isEventModalOpen && (
				<EventModal
					event={editingEvent}
					groups={groups}
					timeSystem={timeSystem}
					onSave={handleSaveEvent}
					onClose={() => {
						setEventModalOpen(false);
						setEditingEvent(null);
					}}
				/>
			)}
			{isGroupModalOpen && (
				<GroupModal
					groups={groups}
					onClose={() => setGroupModalOpen(false)}
				/>
			)}
			{isTimeSystemModalOpen && (
				<TimeSystemModal
					timeSystem={timeSystem}
					onSave={handleSaveTimeSystem}
					onClose={() => setTimeSystemModalOpen(false)}
				/>
			)}
			{isDM && (
				<button
					className="floating-button"
					onClick={() => {
						setEditingEvent(null);
						setEventModalOpen(true);
					}}
				>
					<i className="icon icli iconly-Plus"></i>
				</button>
			)}
		</div>
	);
};

export default Timeline;
