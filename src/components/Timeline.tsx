import React, { useState } from 'react';
import { Event, Group, TimeSystemConfig } from '../types';
import '../styles/Timeline.scss';
import TimeSystemModal from './TimeSystemModal';
import GroupModal from './GroupModal';
import EventModal from './EventModal';

interface TimelineProps {}

const Timeline: React.FC<TimelineProps> = () => {
	// Modals control
	const [isEventModalOpen, setEventModalOpen] = useState(false);
	const [editingEvent, setEditingEvent] = useState<Event | null>(null);
	const [isGroupModalOpen, setGroupModalOpen] = useState(false);
	const [isTimeSystemModalOpen, setTimeSystemModalOpen] = useState(false);
	// Helper to generate unique IDs for demo data
	const generateId = () => Math.random().toString(36).slice(2, 9);

	// Some default demo data to populate the timeline
	const demoGroups: Group[] = [
		{ id: generateId(), name: 'Divine Era', color: '#008080', order: 0 },
		{ id: generateId(), name: 'Immortals Era', color: '#4b0082', order: 1 },
	];

	const demoEvents: Event[] = [
		{
			id: generateId(),
			groupId: demoGroups[0].id,
			title: "Andrann'Ea – Il ciclo della creazione",
			startDate: '10000, DE',
			endDate: '9000, DE',
			description:
				'Inizio del ciclo della creazione. Gli Dei plasmano i vari piani…',
			bannerUrl: '',
			color: demoGroups[0].color,
			hidden: false,
		},
		{
			id: generateId(),
			groupId: demoGroups[0].id,
			title: 'Alesar – La nascita dei semi-Dèi',
			startDate: '9000, DE',
			endDate: '',
			description:
				'Gli esseri semi-divini nascono dalla volontà degli Dei…',
			bannerUrl: '',
			color: demoGroups[0].color,
			hidden: false,
		},
		{
			id: generateId(),
			groupId: demoGroups[0].id,
			title: 'Gil Elhadrin – La venuta degli Elfi',
			startDate: '8800, DE',
			endDate: '',
			description: 'Gli Elfi emergono dalle foreste sacre…',
			bannerUrl: '',
			color: demoGroups[0].color,
			hidden: false,
		},
	];

	const demoTimeSystem: TimeSystemConfig = {
		name: 'Alesar',
		months: [
			{ id: generateId(), name: 'Primos', days: 30 },
			{ id: generateId(), name: 'Secondis', days: 30 },
			{ id: generateId(), name: 'Terzios', days: 30 },
			{ id: generateId(), name: 'Quartis', days: 30 },
			{ id: generateId(), name: 'Quintes', days: 30 },
			{ id: generateId(), name: 'Sixtes', days: 30 },
			{ id: generateId(), name: 'Septis', days: 30 },
			{ id: generateId(), name: 'Octis', days: 30 },
			{ id: generateId(), name: 'Nines', days: 30 },
			{ id: generateId(), name: 'Decis', days: 30 },
		],
		weekdays: [
			{ id: generateId(), name: 'Lunes' },
			{ id: generateId(), name: 'Martes' },
			{ id: generateId(), name: 'Mercos' },
			{ id: generateId(), name: 'Giovis' },
			{ id: generateId(), name: 'Venis' },
			{ id: generateId(), name: 'Sabes' },
			{ id: generateId(), name: 'Domes' },
		],
		eras: [
			{
				id: generateId(),
				abbreviation: 'DE',
				name: 'Divine Era',
				startYear: 10000,
			},
			{
				id: generateId(),
				abbreviation: 'IE',
				name: 'Immortals Era',
				startYear: 0,
			},
		],
		hoursPerDay: 24,
		minutesPerHour: 60,
		epochWeekday: 0,
		weekdaysResetEachMonth: false,
		erasStartOnZeroYear: false,
		dateFormats: {
			year: 'YYYY, E',
			yearMonth: 'MMMM YYYY, E',
			yearMonthDay: 'D^ MMMM YYYY, E',
			yearMonthDayTime: 'D^ MMMM YYYY, HH:mm, E',
		},
	};
	const [groups, setGroups] = React.useState<Group[]>(demoGroups);
	const [events, setEvents] = React.useState<Event[]>(demoEvents);
	const [activeGroupIds, setActiveGroupIds] = React.useState<string[]>(
		groups.map((g) => g.id)
	);
	const [timeSystem, setTimeSystem] =
		React.useState<TimeSystemConfig>(demoTimeSystem);
	const [showHidden, setShowHidden] = React.useState<boolean>(false);
	// Sort events by order property
	const orderedEvents = [...events].sort((a, b) => {
		// If order property exists, use it; fallback to start date descending
		if (typeof a.order === 'number' && typeof b.order === 'number') {
			return a.order - b.order;
		}
		// parse year from string
		const parseYear = (str: string) => {
			const m = str.match(/\d+/);
			return m ? parseInt(m[0], 10) : 0;
		};
		return parseYear(b.startDate) - parseYear(a.startDate);
	});

	const refreshGroupFilters = (updatedGroups: Group[]) => {
		const updatedIds = updatedGroups.map((g) => g.id);
		setActiveGroupIds((prev) =>
			prev.filter((id) => updatedIds.includes(id))
		);
	};

	// Create or update an event
	const handleSaveEvent = (data: Omit<Event, 'id'> & { id?: string }) => {
		if (data.id) {
			// Update existing event
			setEvents((prev) =>
				prev.map((ev) => (ev.id === data.id ? { ...ev, ...data } : ev))
			);
		} else {
			// Create new event
			const id = generateId();
			const newEvent: Event = {
				id,
				order: events.length,
				...data,
			} as Event;
			setEvents((prev) => [...prev, newEvent]);
		}
		setEventModalOpen(false);
		setEditingEvent(null);
	};

	// Create or update group
	const handleSaveGroup = (data: Omit<Group, 'id'> & { id?: string }) => {
		if (data.id) {
			setGroups((prev) =>
				prev.map((g) => (g.id === data.id ? { ...g, ...data } : g))
			);
		} else {
			const id = generateId();
			const order = groups.length;
			const newGroup: Group = { ...data, id, order } as Group;
			setGroups((prev) => [...prev, newGroup]);
			setActiveGroupIds((prev) => [...prev, id]);
		}
		setGroupModalOpen(false);
	};

	// Reorder groups
	const handleReorderGroups = (ordered: Group[]) => {
		setGroups(ordered);
		refreshGroupFilters(ordered);
	};

	// Delete group
	const handleDeleteGroup = (id: string) => {
		setGroups((prev) => prev.filter((g) => g.id !== id));
		refreshGroupFilters(groups.filter((g) => g.id !== id));
		// Remove events of that group
		setEvents((prev) => prev.filter((ev) => ev.groupId !== id));
	};

	// Save time system
	const handleSaveTimeSystem = (data: TimeSystemConfig) => {
		setTimeSystem(data);
		setTimeSystemModalOpen(false);
	};

	// Toggle group filter
	const toggleGroupFilter = (id: string) => {
		setActiveGroupIds((prev) =>
			prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
		);
	};

	// Helper to parse year from startDate string
	const parseYear = (str: string): number => {
		const match = str.match(/\d+/);
		return match ? parseInt(match[0], 10) : 0;
	};

	const renderEvent = (ev: Event, index: number) => {
		// compute difference from previous event for caption
		const prev = index > 0 ? orderedEvents[index - 1] : null;
		let diffLabel = '';
		if (prev) {
			const diff = parseYear(prev.startDate) - parseYear(ev.startDate);
			if (diff > 0) {
				diffLabel = `${diff.toLocaleString()} years later`;
			}
		}
		const group = groups.find((g) => g.id === ev.groupId);
		function onEditEvent(ev: Event): void {
			setEditingEvent(ev);
			setEventModalOpen(true);
		}

		// event card style
		// Compose a card that splits into info and image sections. The card uses a
		// dark translucent background and rounded corners. The group name is
		// displayed as a pill at the top of the info section. If a banner image
		// exists it will occupy the right side of the card.
		return (
			<div className="timeline-event-wrapper">
				<div
					key={ev.id}
					className="event"
					style={
						{
							'--group-color':
								ev.color || group?.color || '#475569',
						} as React.CSSProperties
					}
				>
					{/* vertical line to next event (except last) */}
					<div className="line"></div>
					<div className="row">
						{/* Date and difference column */}
						<div className="date">
							<div className="year">{ev.startDate}</div>
							{diffLabel && (
								<div className="diff">{diffLabel}</div>
							)}
						</div>
						{/* Triangle marker (diamond) */}
						<div className="marker">
							<div className="diamond"></div>
						</div>
						{/* Event card */}
						<div className="cardWrapper">
							<div className="card">
								<div className="info">
									{/* Group label */}
									<span className="groupLabel">
										{group?.name || 'Group'}
									</span>
									<div>
										<h3 className="title">{ev.title}</h3>
										<div className="subtitle">
											{ev.startDate}
											{ev.endDate
												? ` → ${ev.endDate}`
												: ''}
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
											className="editButton"
											onClick={() => onEditEvent(ev)}
										>
											Edit
										</button>
									</div>
								</div>
								{/* Right image section */}
								{ev.bannerUrl ? (
									<div
										className="image"
										style={{
											backgroundImage: `url(${ev.bannerUrl})`,
										}}
									></div>
								) : null}
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="timeline">
			{' '}
			{/* Header with actions (not including nav) */}
			<header className="timelineHeader">
				<div className="groupFilter">
					{groups
						.sort((a, b) => a.order - b.order)
						.map((group) => (
							<button
								key={group.id}
								className={`pill ${
									activeGroupIds.includes(group.id)
										? 'active'
										: ''
								}`}
								onClick={() => toggleGroupFilter(group.id)}
							>
								{group.name.toUpperCase()}
							</button>
						))}
				</div>
				{/* Show hidden toggle with icon */}
				<button
					className="showHidden"
					onClick={() => setShowHidden((prev) => !prev)}
				>
					<span className="icon">{showHidden ? '👁️' : '👁️'}</span>
					<span className="text">
						{showHidden ? 'Hide hidden' : 'Show hidden'}
					</span>
				</button>
			</header>
			<div className="timeline-wrapper">
				{orderedEvents
					.filter(
						(ev) =>
							activeGroupIds.includes(ev.groupId) &&
							(showHidden || !ev.hidden)
					)
					.map((ev, index) => (
						<div key={ev.id}>{renderEvent(ev, index)}</div>
					))}
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
					onSave={handleSaveGroup}
					onReorder={handleReorderGroups}
					onDelete={handleDeleteGroup}
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
			<button
				className="createButton"
				onClick={() => {
					setEditingEvent(null);
					setEventModalOpen(true);
				}}
			>
				+ Create Event
			</button>
		</div>
	);
};

export default Timeline;
