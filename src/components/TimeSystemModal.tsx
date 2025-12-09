import React, { useState } from 'react';
import Modal from 'react-modal';
import { TimeSystemConfig, Month, Weekday, Era } from '../types';
import {
	DragDropContext,
	Droppable,
	Draggable,
	DropResult,
	DraggableProps,
} from '@hello-pangea/dnd';
import { useAppStore } from '../store/appStore';
import DatePicker, { PickerValue, DateChangeFormatted } from './DatePicker';
import '../styles/TimeSystem.scss';
import { XIcon } from '@phosphor-icons/react/dist/icons/X';
import { createPortal } from 'react-dom';

interface TimeSystemModalProps {
	timeSystem?: TimeSystemConfig;
	onSave?: (ts: TimeSystemConfig) => void;
	onClose: () => void;
}

Modal.setAppElement('#root');

// Portal target for dragging inside fixed/overlay containers
const portalEl =
	typeof document !== 'undefined'
		? document.getElementById('dnd-portal') ||
		  (() => {
				const el = document.createElement('div');
				el.id = 'dnd-portal';
				document.body.appendChild(el);
				return el;
		  })()
		: null;

// Wrap Draggable so the dragging clone renders in the portal, keeping correct positioning
const PortalAwareDraggable: React.FC<DraggableProps> = (props) => (
	<Draggable {...props}>
		{(provided, snapshot, rubic) => {
			const child = props.children(provided, snapshot, rubic);
			return snapshot.isDragging && portalEl
				? createPortal(child, portalEl)
				: child;
		}}
	</Draggable>
);

// Helper to generate a short random ID. This replicates the generateId helper used elsewhere.
const generateId = () => Math.random().toString(36).slice(2, 9);

// Ensure every entity has a stable `_id` and not legacy `id`
const normalizeTimeSystem = (ts: TimeSystemConfig): TimeSystemConfig => {
	const months = (ts.months || []).map((m: any) => ({
		id: m.id || m.id || generateId(),
		name: m.name,
		days: typeof m.days === 'number' ? m.days : 30,
	}));
	const weekdays = (ts.weekdays || []).map((d: any) => ({
		id: d.id || d.id || generateId(),
		name: d.name,
	}));
	const eras = (ts.eras || []).map((e: any) => ({
		id: e.id || e.id || generateId(),
		abbreviation: e.abbreviation,
		name: e.name,
		startYear: typeof e.startYear === 'number' ? e.startYear : 0,
		backward: !!e.backward,
	}));
	return {
		name: ts.name || '',
		months,
		weekdays,
		eras,
		hoursPerDay: ts.hoursPerDay ?? 24,
		minutesPerHour: ts.minutesPerHour ?? 60,
		epochWeekday: Math.min(
			Math.max(ts.epochWeekday ?? 0, 0),
			Math.max(0, weekdays.length - 1)
		),
		weekdaysResetEachMonth: !!ts.weekdaysResetEachMonth,
		erasStartOnZeroYear: !!ts.erasStartOnZeroYear,
		dateFormats: { ...ts.dateFormats },
	} as TimeSystemConfig;
};

const TimeSystemModal: React.FC<TimeSystemModalProps> = ({
	timeSystem,
	onSave,
	onClose,
}) => {
	// Read from store if not provided via props
	const storeTS = useAppStore((s) => s.data.timeSystem.data);
	const saveTimeSystem = useAppStore((s) => s.saveTimeSystem);
	// Choose source: prop if provided, else store, else defaults, then normalize
	const src = normalizeTimeSystem(
		timeSystem ||
			storeTS || {
				name: '',
				months: [] as Month[],
				weekdays: [] as Weekday[],
				eras: [] as Era[],
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
			}
	);

	const [localTS, setLocalTS] = useState<TimeSystemConfig>({ ...src });

	// Active tab for editing. Options: overview, months, weekdays, eras, formats
	const [activeTab, setActiveTab] = useState<
		'overview' | 'months' | 'weekdays' | 'eras' | 'formats'
	>('overview');

	// Handlers to update individual fields
	const updateMonthField = (id: string, field: keyof Month, value: any) => {
		setLocalTS((prev) => ({
			...prev,
			months: prev.months.map((m) =>
				m.id === id ? { ...m, [field]: value } : m
			),
		}));
	};

	const addMonth = () => {
		setLocalTS((prev) => ({
			...prev,
			months: [
				...prev.months,
				{
					id: generateId(),
					name: `Month ${prev.months.length + 1}`,
					days: 30,
				},
			],
		}));
	};

	const deleteMonth = (id: string) => {
		setLocalTS((prev) => ({
			...prev,
			months: prev.months.filter((m) => m.id !== id),
		}));
	};

	const onMonthsDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		const items = Array.from(localTS.months);
		const [moved] = items.splice(result.source.index, 1);
		items.splice(result.destination.index, 0, moved);
		setLocalTS((prev) => ({ ...prev, months: items }));
	};

	// Weekday handlers
	const updateWeekdayField = (id: string, value: string) => {
		setLocalTS((prev) => ({
			...prev,
			weekdays: prev.weekdays.map((d) =>
				d.id === id ? { ...d, name: value } : d
			),
		}));
	};

	const addWeekday = () => {
		setLocalTS((prev) => ({
			...prev,
			weekdays: [
				...prev.weekdays,
				{ id: generateId(), name: `Day ${prev.weekdays.length + 1}` },
			],
		}));
	};

	const deleteWeekday = (id: string) => {
		setLocalTS((prev) => ({
			...prev,
			weekdays: prev.weekdays.filter((d) => d.id !== id),
		}));
	};

	const onWeekdaysDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		const items = Array.from(localTS.weekdays);
		const [moved] = items.splice(result.source.index, 1);
		items.splice(result.destination.index, 0, moved);
		// Compute new epochWeekday index based on original day id
		const oldEpochId = localTS.weekdays[localTS.epochWeekday]?.id;
		const newEpochIndex = items.findIndex((d) => d.id === oldEpochId);
		setLocalTS((prev) => ({
			...prev,
			weekdays: items,
			epochWeekday: newEpochIndex >= 0 ? newEpochIndex : 0,
		}));
	};

	// Era handlers
	const updateEraField = (id: string, field: keyof Era, value: any) => {
		setLocalTS((prev) => ({
			...prev,
			eras: prev.eras.map((e) =>
				e.id === id ? { ...e, [field]: value } : e
			),
		}));
	};

	const addEra = (backward: boolean = false) => {
		setLocalTS((prev) => ({
			...prev,
			eras: [
				...prev.eras,
				{
					id: generateId(),
					abbreviation: `E${prev.eras.length + 1}`,
					name: `Era ${prev.eras.length + 1}`,
					startYear: backward ? 10000 : 0,
					backward,
				},
			],
		}));
	};

	const handleEraDateChange = (eraId: string, parts: PickerValue | null) => {
		if (parts) {
			const year = parseInt(parts.year, 10);
			if (!isNaN(year)) {
				updateEraField(eraId, 'startYear', year);
			}
		}
	};

	const getEraDatePickerValue = (era: Era): PickerValue => {
		return {
			eraId: era.id,
			year: era.startYear.toString(),
			monthIndex: '0', // First month (Primos)
			day: '1', // First day
		};
	};

	const deleteEra = (id: string) => {
		setLocalTS((prev) => ({
			...prev,
			eras: prev.eras.filter((e) => e.id !== id),
		}));
	};

	// Reorder only forward eras; backward eras stay fixed where they are
	const onErasDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		const forward = localTS.eras.filter((e) => !e.backward);
		const reordered = Array.from(forward);
		const [moved] = reordered.splice(result.source.index, 1);
		if (!moved) return;
		reordered.splice(result.destination.index, 0, moved);

		// Merge back into the original layout so backward eras keep position
		const forwardQueue = [...reordered];
		const merged = localTS.eras.map((era) =>
			era.backward ? era : forwardQueue.shift() || era
		);

		setLocalTS((prev) => ({ ...prev, eras: merged }));
	};

	// Handler for saving changes
	const handleSave = async () => {
		// Normalize epochWeekday to be within range
		const epoch = Math.min(
			Math.max(localTS.epochWeekday, 0),
			localTS.weekdays.length - 1
		);
		const payload = { ...localTS, epochWeekday: epoch } as TimeSystemConfig;
		try {
			if (onSave) {
				onSave(payload);
			} else {
				await saveTimeSystem(payload);
			}
			onClose();
		} catch (e) {
			// Optionally show a toast or console error
			console.error('Failed to save time system', e);
		}
	};

	return (
		<Modal
			isOpen={true}
			onRequestClose={onClose}
			contentLabel="Time System Editor"
			className="modal__content tsm__content"
			overlayClassName="modal__overlay"
		>
			{/* Left navigation */}
			<div className="tsm__nav">
				<h3 className="tsm__title">Time System Editor</h3>
				<nav className="tsm__navlist">
					<button
						className={`tsm__navbtn ${
							activeTab === 'overview' ? 'is-active' : ''
						}`}
						onClick={() => setActiveTab('overview')}
					>
						Overview
					</button>
					<button
						className={`tsm__navbtn ${
							activeTab === 'months' ? 'is-active' : ''
						}`}
						onClick={() => setActiveTab('months')}
					>
						Months
					</button>
					<button
						className={`tsm__navbtn ${
							activeTab === 'weekdays' ? 'is-active' : ''
						}`}
						onClick={() => setActiveTab('weekdays')}
					>
						Weekdays
					</button>
					<button
						className={`tsm__navbtn ${
							activeTab === 'eras' ? 'is-active' : ''
						}`}
						onClick={() => setActiveTab('eras')}
					>
						Years / Eras
					</button>
					<button
						className={`tsm__navbtn ${
							activeTab === 'formats' ? 'is-active' : ''
						}`}
						onClick={() => setActiveTab('formats')}
					>
						Settings
					</button>
				</nav>
			</div>
			{/* Content area */}
			<div className="modal__body">
				{/* OVERVIEW */}
				{activeTab === 'overview' && (
					<div className="modal__body_content">
						<h3 className="tsm__sectionTitle">Overview</h3>
						<div className="tsm__grid">
							<div className="modal__field">
								<label className="tsm__label">
									Name
									<input
										className="modal__input"
										type="text"
										value={localTS.name}
										onChange={(e) =>
											setLocalTS((prev) => ({
												...prev,
												name: e.target.value,
											}))
										}
									/>
								</label>
							</div>
							<div className="modal__field">
								<label className="tsm__label">
									Hours per day
									<input
										className="modal__input"
										type="number"
										min={1}
										value={localTS.hoursPerDay}
										onChange={(e) =>
											setLocalTS((prev) => ({
												...prev,
												hoursPerDay:
													parseInt(
														e.target.value,
														10
													) || prev.hoursPerDay,
											}))
										}
									/>
								</label>
							</div>
							<div className="modal__field">
								<label className="tsm__label">
									Minutes per hour
									<input
										className="modal__input"
										type="number"
										min={1}
										value={localTS.minutesPerHour}
										onChange={(e) =>
											setLocalTS((prev) => ({
												...prev,
												minutesPerHour:
													parseInt(
														e.target.value,
														10
													) || prev.minutesPerHour,
											}))
										}
									/>
								</label>
							</div>
							<div className="modal__field">
								<label className="tsm__label">
									Epoch weekday
									<select
										className="modal__select"
										value={localTS.epochWeekday}
										onChange={(e) =>
											setLocalTS((prev) => ({
												...prev,
												epochWeekday: parseInt(
													e.target.value,
													10
												),
											}))
										}
									>
										{localTS.weekdays.map((d, idx) => (
											<option key={d.id} value={idx}>
												{d.name}
											</option>
										))}
									</select>
								</label>
							</div>
							<div className="checkbox-wrapper">
								<input
									className="input-checkbox input-checkbox-light"
									type="checkbox"
									id="hidden-checkbox"
									checked={localTS.weekdaysResetEachMonth}
									onChange={(e) =>
										setLocalTS((prev) => ({
											...prev,
											weekdaysResetEachMonth:
												e.target.checked,
										}))
									}
								/>

								<label
									className="input-checkbox-btn"
									htmlFor="hidden-checkbox"
								></label>
								<span className="form-label">
									Weekday numbering resets each month
								</span>
							</div>
							<div className="checkbox-wrapper">
								<input
									className="input-checkbox input-checkbox-light"
									type="checkbox"
									id="second-hidden-checkbox"
									checked={localTS.erasStartOnZeroYear}
									onChange={(e) =>
										setLocalTS((prev) => ({
											...prev,
											erasStartOnZeroYear:
												e.target.checked,
										}))
									}
								/>

								<label
									className="input-checkbox-btn"
									htmlFor="second-hidden-checkbox"
								></label>
								<span className="form-label">
									Eras start on year 0 (otherwise year 1)
								</span>
							</div>
						</div>
					</div>
				)}

				{/* MONTHS */}
				{activeTab === 'months' && (
					<div className="modal__body_content">
						<h3 className="tsm__sectionTitle">Months</h3>
						<p className="tsm__help">
							Reorder months by dragging the handle. You can
							rename each month and set the number of days it
							contains.
						</p>
						<DragDropContext
							onDragEnd={onMonthsDragEnd}
							key={'months-context'}
						>
							<Droppable droppableId="months-droppable">
								{(provided) => (
									<div
										ref={provided.innerRef}
										{...provided.droppableProps}
										className="draggable__list scrollable-dnd-list"
									>
										{localTS.months.map((m, index) => (
											<PortalAwareDraggable
												key={m.id}
												draggableId={m.id}
												index={index}
											>
												{(prov) => (
													<div
														ref={prov.innerRef}
														{...prov.draggableProps}
														className="draggable__listItem"
														style={
															prov.draggableProps
																.style
														}
													>
														<span
															{...prov.dragHandleProps}
															className="draggable__handle"
														></span>
														<span className="draggable__index">
															{index + 1}
														</span>
														<input
															className="draggable__input draggable__input--flex"
															type="text"
															value={m.name}
															onChange={(e) =>
																updateMonthField(
																	m.id,
																	'name',
																	e.target
																		.value
																)
															}
														/>
														<input
															className="draggable__input draggable__input--num"
															type="number"
															min={1}
															value={m.days}
															onChange={(e) =>
																updateMonthField(
																	m.id,
																	'days',
																	parseInt(
																		e.target
																			.value,
																		10
																	) || 1
																)
															}
														/>
														<button
															className="draggable__iconbtn draggable__iconbtn--danger"
															type="button"
															onClick={() =>
																deleteMonth(
																	m.id
																)
															}
															title="Delete month"
														>
															✖
														</button>
													</div>
												)}
											</PortalAwareDraggable>
										))}
										{provided.placeholder}
									</div>
								)}
							</Droppable>
						</DragDropContext>
						<button
							type="button"
							onClick={addMonth}
							className="draggable__btn draggable__btn--primary"
						>
							+ Add month
						</button>
					</div>
				)}

				{/* WEEKDAYS */}
				{activeTab === 'weekdays' && (
					<div className="modal__body_content">
						<h3 className="tsm__sectionTitle">Weekdays</h3>
						<p className="tsm__help">
							Reorder weekdays by dragging. Rename them or
							remove/add new ones. Select which weekday marks the
							start of year zero.
						</p>
						<DragDropContext
							onDragEnd={onWeekdaysDragEnd}
							key={'weekdays-context'}
						>
							<Droppable droppableId="weekdays-droppable">
								{(provided) => (
									<div
										ref={provided.innerRef}
										{...provided.droppableProps}
										className="draggable__list scrollable-dnd-list"
									>
										{localTS.weekdays.map((d, index) => (
											<PortalAwareDraggable
												key={d.id}
												draggableId={d.id}
												index={index}
											>
												{(prov) => (
													<div
														ref={prov.innerRef}
														{...prov.draggableProps}
														className="draggable__listItem"
														style={
															prov.draggableProps
																.style
														}
													>
														<span
															{...prov.dragHandleProps}
															className="draggable__handle"
														>
															☰
														</span>
														<span className="draggable__index">
															{index + 1}
														</span>
														<input
															className="draggable__input draggable__input--flex"
															type="text"
															value={d.name}
															onChange={(e) =>
																updateWeekdayField(
																	d.id,
																	e.target
																		.value
																)
															}
														/>
														<button
															className="draggable__iconbtn draggable__iconbtn--danger"
															type="button"
															onClick={() =>
																deleteWeekday(
																	d.id
																)
															}
															title="Delete day"
														>
															✖
														</button>
													</div>
												)}
											</PortalAwareDraggable>
										))}
										{provided.placeholder}
									</div>
								)}
							</Droppable>
						</DragDropContext>
						<button
							type="button"
							onClick={addWeekday}
							className="draggable__btn draggable__btn--primary"
						>
							+ Add weekday
						</button>
					</div>
				)}

				{/* ERAS */}
				{activeTab === 'eras' && (
					<div className="modal__body_content">
						<h3 className="tsm__sectionTitle">Years / Eras</h3>

						{/* Backward Era Section */}
						<div className="tsm__eraSection">
							<div className="tsm__eraHeader">
								<h4 className="tsm__eraTitle">
									BACKWARD ERA (OPTIONAL)
								</h4>
								<span className="tsm__eraSubtitle">
									START DATE
								</span>
							</div>
							<p className="tsm__help">
								A backward era counts from a start year down to
								1, ending at year 0. Only one backward era is
								allowed.
							</p>
							{localTS.eras
								.filter((e) => e.backward)
								.map((er) => (
									<div key={er.id} className="tsm__eraItem">
										<input
											className="tsm__eraInput tsm__eraInput--abbr"
											type="text"
											value={er.abbreviation}
											onChange={(e) =>
												updateEraField(
													er.id,
													'abbreviation',
													e.target.value
												)
											}
											placeholder="DE"
										/>
										<input
											className="tsm__eraInput tsm__eraInput--name"
											type="text"
											value={er.name}
											onChange={(e) =>
												updateEraField(
													er.id,
													'name',
													e.target.value
												)
											}
											placeholder="Divine Era"
										/>
										<div className="tsm__eraDate">
											<DatePicker
												ts={localTS}
												value={getEraDatePickerValue(
													er
												)}
												onChange={(parts) =>
													handleEraDateChange(
														er.id,
														parts
													)
												}
												format="year"
												placeholder="Select start year"
												hideEraSelector
												positionAbove
											/>
										</div>
										<button
											className="tsm__eraDeleteBtn draggable__iconbtn draggable__iconbtn--danger"
											type="button"
											onClick={() => deleteEra(er.id)}
											title="Delete backward era"
										>
											<XIcon size={16} />
										</button>
									</div>
								))}
							{localTS.eras.filter((e) => e.backward).length ===
								0 && (
								<button
									type="button"
									onClick={() => addEra(true)}
									className="draggable__btn draggable__btn--secondary"
								>
									+ Add era
								</button>
							)}
						</div>

						{/* Forward Eras Section */}
						<div className="tsm__eraSection tsm__eraSection--forward">
							<div className="tsm__eraHeader">
								<h4 className="tsm__eraTitle">FORWARD ERAS</h4>
								<span className="tsm__eraSubtitle">
									START DATE
								</span>
							</div>
							<p className="tsm__help">
								Forward eras count from a start year upward. You
								can have multiple forward eras. Drag to reorder.
							</p>
							<DragDropContext
								onDragEnd={onErasDragEnd}
								key={'eras-context'}
							>
								<Droppable droppableId="eras-droppable">
									{(provided) => (
										<div
											ref={provided.innerRef}
											{...provided.droppableProps}
											className="tsm__eraList"
										>
											{localTS.eras
												.filter((e) => !e.backward)
												.map((er, index) => (
													<PortalAwareDraggable
														key={er.id}
														draggableId={er.id}
														index={index}
													>
														{(prov) => (
															<div
																ref={
																	prov.innerRef
																}
																{...prov.draggableProps}
																className="tsm__eraItem"
																style={
																	prov
																		.draggableProps
																		.style
																}
															>
																<span
																	{...prov.dragHandleProps}
																	className="tsm__eraDragHandle"
																>
																	⋮⋮
																</span>
																<input
																	className="tsm__eraInput tsm__eraInput--abbr"
																	type="text"
																	value={
																		er.abbreviation
																	}
																	onChange={(
																		e
																	) =>
																		updateEraField(
																			er.id,
																			'abbreviation',
																			e
																				.target
																				.value
																		)
																	}
																	placeholder="IE"
																/>
																<input
																	className="tsm__eraInput tsm__eraInput--name"
																	type="text"
																	value={
																		er.name
																	}
																	onChange={(
																		e
																	) =>
																		updateEraField(
																			er.id,
																			'name',
																			e
																				.target
																				.value
																		)
																	}
																	placeholder="Immortals Era"
																/>
																<div className="tsm__eraDate">
																	<DatePicker
																		ts={
																			localTS
																		}
																		value={getEraDatePickerValue(
																			er
																		)}
																		onChange={(
																			parts
																		) =>
																			handleEraDateChange(
																				er.id,
																				parts
																			)
																		}
																		format="year"
																		placeholder="Select start year"
																		hideEraSelector
																		positionAbove
																	/>
																</div>
																<button
																	className="tsm__eraDeleteBtn draggable__iconbtn draggable__iconbtn--danger"
																	type="button"
																	onClick={() =>
																		deleteEra(
																			er.id
																		)
																	}
																	title="Delete group"
																>
																	<XIcon
																		size={
																			16
																		}
																	/>
																</button>
															</div>
														)}
													</PortalAwareDraggable>
												))}
											{provided.placeholder}
										</div>
									)}
								</Droppable>
							</DragDropContext>
							<button
								type="button"
								onClick={() => addEra(false)}
								className="draggable__btn draggable__btn--primary"
							>
								+ Add era
							</button>
						</div>
					</div>
				)}

				{/* FORMATS */}
				{activeTab === 'formats' && (
					<div className="modal__body_content">
						<h3 className="tsm__sectionTitle">
							Customize date display
						</h3>
						<p className="tsm__help">
							Define how your dates are formatted. Use the codes
							listed to include era names, years, months and days.
						</p>
						<div className="tsm__formats">
							<div className="tsm__formatsCol">
								<label className="tsm__label">
									Year
									<input
										className="modal__input"
										type="text"
										value={localTS.dateFormats.year}
										onChange={(e) =>
											setLocalTS((prev) => ({
												...prev,
												dateFormats: {
													...prev.dateFormats,
													year: e.target.value,
												},
											}))
										}
									/>
								</label>
								<div className="tsm__example">
									Example:{' '}
									{localTS.dateFormats.year
										.replace(/YYYY/g, '4629')
										.replace(
											/E/g,
											localTS.eras[0]?.abbreviation || ''
										)}
								</div>
								<label className="tsm__label tsm__label--spaced">
									Year Month
									<input
										className="modal__input"
										type="text"
										value={localTS.dateFormats.yearMonth}
										onChange={(e) =>
											setLocalTS((prev) => ({
												...prev,
												dateFormats: {
													...prev.dateFormats,
													yearMonth: e.target.value,
												},
											}))
										}
									/>
								</label>
								<label className="tsm__label tsm__label--spaced">
									Year Month Day
									<input
										className="modal__input"
										type="text"
										value={localTS.dateFormats.yearMonthDay}
										onChange={(e) =>
											setLocalTS((prev) => ({
												...prev,
												dateFormats: {
													...prev.dateFormats,
													yearMonthDay:
														e.target.value,
												},
											}))
										}
									/>
								</label>
								<label className="tsm__label tsm__label--spaced">
									Year Month Day Time
									<input
										className="modal__input"
										type="text"
										value={
											localTS.dateFormats.yearMonthDayTime
										}
										onChange={(e) =>
											setLocalTS((prev) => ({
												...prev,
												dateFormats: {
													...prev.dateFormats,
													yearMonthDayTime:
														e.target.value,
												},
											}))
										}
									/>
								</label>
							</div>
							<div className="tsm__formatsCol tsm__formatsCol--codes">
								<h4 className="tsm__subtitle">Display codes</h4>
								<ul className="tsm__codes">
									<li>
										<code>E</code> – Era abbreviation
									</li>
									<li>
										<code>EE</code> – Era name
									</li>
									<li>
										<code>YYYY</code> – Year (4 digits)
									</li>
									<li>
										<code>YY</code> – Year (2 digits)
									</li>
									<li>
										<code>MMMM</code> – Month name
									</li>
									<li>
										<code>MM</code> – Month number (2
										digits)
									</li>
									<li>
										<code>M</code> – Month number
									</li>
									<li>
										<code>D^</code> – Day with ordinal
										(e.g., 1st, 2nd)
									</li>
									<li>
										<code>DD</code> – Day (2 digits)
									</li>
									<li>
										<code>D</code> – Day
									</li>
									<li>
										Text in square brackets like [Text] is
										ignored
									</li>
								</ul>
							</div>
						</div>
					</div>
				)}

				{/* Actions */}
				<div className="modal__actions">
					<button
						type="button"
						onClick={onClose}
						className="draggable__btn draggable__btn--muted"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						className="draggable__btn draggable__btn--primary"
					>
						Save
					</button>
				</div>
			</div>
		</Modal>
	);
};

export default TimeSystemModal;
