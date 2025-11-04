import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
	CalendarBlank,
	CaretLeft,
	CaretRight,
	Rewind,
	FastForward,
	XCircle,
} from 'phosphor-react';
import '../styles/DatePicker.scss';

export type SessionDatePickerProps = {
	/** Current value in DD/MM/YYYY format. If null/undefined, field appears empty */
	value?: string | null;
	/** Placeholder when empty */
	placeholder?: string;
	/** Label shown above the input (optional) */
	label?: string;
	/** Called with DD/MM/YYYY string or null if cleared */
	onChange: (dateStr: string | null) => void;
	/** Show a clear (X) button */
	clearable?: boolean;
};

/* ---------------- helpers ---------------- */

const parseSessionDate = (s?: string | null): Date | null => {
	if (!s || typeof s !== 'string') return null;
	const m = s.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
	if (!m) return null;
	const [_, dd, mm, yyyy] = m;
	const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
	return isNaN(d.getTime()) ? null : d;
};

const formatSessionDate = (d: Date): string => {
	const dd = String(d.getDate()).padStart(2, '0');
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const yyyy = String(d.getFullYear());
	return `${dd}/${mm}/${yyyy}`;
};

const useOutsideClose = (open: boolean, onClose: () => void) => {
	const ref = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		if (!open) return;
		const onClick = (e: MouseEvent) => {
			if (!ref.current) return;
			if (!ref.current.contains(e.target as Node)) onClose();
		};
		document.addEventListener('mousedown', onClick);
		return () => document.removeEventListener('mousedown', onClick);
	}, [open, onClose]);
	return ref;
};

const daysInMonth = (year: number, month: number): number => {
	return new Date(year, month + 1, 0).getDate();
};

const firstWeekdayOfMonth = (year: number, month: number): number => {
	// 0 = Sunday, 1 = Monday, etc. (standard JS Date)
	const day = new Date(year, month, 1).getDay();
	// Convert to Monday = 0 convention
	return day === 0 ? 6 : day - 1;
};

/* ---------------- component ---------------- */

const SessionDatePicker: React.FC<SessionDatePickerProps> = ({
	value,
	placeholder = 'Pick a date',
	label,
	onChange,
	clearable = false,
}) => {
	// Parse initial value or default to today
	const initialDate = useMemo(() => {
		const parsed = parseSessionDate(value);
		return parsed || new Date();
	}, [value]);

	const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
	const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-11
	const [selectedDate, setSelectedDate] = useState<Date | null>(
		parseSessionDate(value)
	);

	const [open, setOpen] = useState(false);
	const popRef = useOutsideClose(open, () => setOpen(false));

	// Update local state when parent value changes
	useEffect(() => {
		const parsed = parseSessionDate(value);
		setSelectedDate(parsed);
		if (parsed) {
			setViewYear(parsed.getFullYear());
			setViewMonth(parsed.getMonth());
		}
	}, [value]);

	// Display formatted date or placeholder
	const display = useMemo(() => {
		if (!selectedDate) return '';
		return formatSessionDate(selectedDate);
	}, [selectedDate]);

	/* -------- month navigation -------- */
	const prevMonth = () => {
		if (viewMonth === 0) {
			setViewYear(viewYear - 1);
			setViewMonth(11);
		} else {
			setViewMonth(viewMonth - 1);
		}
	};

	const nextMonth = () => {
		if (viewMonth === 11) {
			setViewYear(viewYear + 1);
			setViewMonth(0);
		} else {
			setViewMonth(viewMonth + 1);
		}
	};

	const prevYear = () => setViewYear(viewYear - 1);
	const nextYear = () => setViewYear(viewYear + 1);

	/* -------- grid with weekday offset & spill days -------- */
	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];
	const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	const firstWd = firstWeekdayOfMonth(viewYear, viewMonth);
	const curDays = daysInMonth(viewYear, viewMonth);
	const prevMonthDays =
		viewMonth === 0
			? daysInMonth(viewYear - 1, 11)
			: daysInMonth(viewYear, viewMonth - 1);

	const cells: Array<{
		day: number;
		inMonth: -1 | 0 | 1;
		year: number;
		month: number;
	}> = [];

	// Previous month spill
	for (let i = 0; i < firstWd; i++) {
		const d = prevMonthDays - firstWd + 1 + i;
		const spillYear = viewMonth === 0 ? viewYear - 1 : viewYear;
		const spillMonth = viewMonth === 0 ? 11 : viewMonth - 1;
		cells.push({ day: d, inMonth: -1, year: spillYear, month: spillMonth });
	}

	// Current month
	for (let d = 1; d <= curDays; d++) {
		cells.push({ day: d, inMonth: 0, year: viewYear, month: viewMonth });
	}

	// Next month spill to complete rows
	const trailing = (7 - (cells.length % 7)) % 7;
	for (let i = 1; i <= trailing; i++) {
		const spillYear = viewMonth === 11 ? viewYear + 1 : viewYear;
		const spillMonth = viewMonth === 11 ? 0 : viewMonth + 1;
		cells.push({ day: i, inMonth: 1, year: spillYear, month: spillMonth });
	}

	const handleDayClick = (c: (typeof cells)[0]) => {
		const newDate = new Date(c.year, c.month, c.day);
		setSelectedDate(newDate);
		onChange(formatSessionDate(newDate));
		setOpen(false);
	};

	return (
		<div className="datepick">
			{label && <div className="datepick__label">{label}</div>}

			<div className="datepick__inputWrap session-datepicker">
				<CalendarBlank
					weight="bold"
					size={20}
					className="icon__hover gold_on_hover"
				/>
				<input
					className="modal__input datepill"
					onFocus={() => setOpen(true)}
					onClick={() => setOpen(true)}
					readOnly
					value={display}
					placeholder={placeholder}
					aria-haspopup="dialog"
					aria-expanded={open}
				/>
				{clearable && display && (
					<button
						type="button"
						className="datepill__icon-end"
						onClick={() => {
							setSelectedDate(null);
							onChange(null);
						}}
						aria-label="Clear date"
					>
						<XCircle
							size={30}
							weight="bold"
							className="icon__hover dim_on_hover"
						/>
					</button>
				)}
			</div>

			{open && (
				<div ref={popRef} className="dp-pop custom-datepicker">
					<div className="dp-pop__panel">
						{/* Header: nav + month select + year input */}
						<div className="dp-pop__head">
							<button
								type="button"
								className="dp-pop__navbtn"
								onClick={prevYear}
								aria-label="Previous year"
							>
								<Rewind size={16} />
							</button>
							<button
								type="button"
								className="dp-pop__navbtn"
								onClick={prevMonth}
								aria-label="Previous month"
							>
								<CaretLeft size={16} />
							</button>

							<div className="dp-pop__headmain">
								<select
									className="modal__select"
									value={String(viewMonth)}
									style={{ backgroundImage: 'none' }}
									onChange={(e) =>
										setViewMonth(
											parseInt(e.target.value, 10)
										)
									}
								>
									{monthNames.map((name, i) => (
										<option key={i} value={String(i)}>
											{name}
										</option>
									))}
								</select>

								<input
									className="modal__input dp-pop__year"
									type="number"
									value={String(viewYear)}
									onChange={(e) =>
										setViewYear(
											parseInt(e.target.value, 10) ||
												viewYear
										)
									}
									placeholder="Year"
								/>
							</div>

							<button
								type="button"
								className="dp-pop__navbtn"
								onClick={nextMonth}
								aria-label="Next month"
							>
								<CaretRight size={16} />
							</button>
							<button
								type="button"
								className="dp-pop__navbtn"
								onClick={nextYear}
								aria-label="Next year"
							>
								<FastForward size={16} />
							</button>
						</div>

						{/* Week row */}
						<div className="dp-pop__grid dp-pop__week">
							{weekDays.map((w) => (
								<div key={w} className="dp-pop__weekcell">
									{w}
								</div>
							))}
						</div>

						{/* Days grid (with spill days) */}
						<div className="dp-pop__grid dp-pop__days">
							{cells.map((c, idx) => {
								const isOutside = c.inMonth !== 0;
								const isSelected =
									selectedDate &&
									c.day === selectedDate.getDate() &&
									c.month === selectedDate.getMonth() &&
									c.year === selectedDate.getFullYear();

								return (
									<button
										key={`${c.year}-${c.month}-${c.day}-${idx}`}
										type="button"
										className={`dp-pop__daybtn${
											isOutside ? ' is-outside' : ''
										}${isSelected ? ' is-selected' : ''}`}
										onClick={() => handleDayClick(c)}
									>
										{c.day}
									</button>
								);
							})}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default SessionDatePicker;
