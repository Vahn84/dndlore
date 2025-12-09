import React, {
	useEffect,
	useMemo,
	useRef,
	useState,
	useLayoutEffect,
	useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';
import { RewindIcon } from '@phosphor-icons/react/dist/csr/Rewind';
import { FastForwardIcon } from '@phosphor-icons/react/dist/csr/FastForward';
import { XCircleIcon } from '@phosphor-icons/react/dist/csr/XCircle';
import type { TimeSystemConfig } from '../types';
import '../styles/DatePicker.scss';

/** Parts the parent will store for saving */
export type PickerValue = {
	eraId: string;
	year: string;
	monthIndex: string;
	day: string;
	hour?: string;
	minute?: string;
};

/** Optional preformatted strings the parent can use immediately in UI */
export type DateChangeFormatted = {
	year: string; // e.g. "10000, DE"
	yearMonth: string; // e.g. "Primos 10000, DE"
	yearMonthDay: string; // e.g. "1st Primos 10000, DE"
	time?: string; // e.g. "21:30"
};

export type DatePickerProps = {
	/** Time System that defines months, eras and date formats. May be undefined while booting. */
	ts?: TimeSystemConfig | null;
	/** Current value. If null/undefined, field appears empty */
	value?: PickerValue | null;
	/** Placeholder when empty */
	placeholder?: string;
	/** Show a clear (X) button (e.g., for End date) */
	clearable?: boolean;
	/** Label shown above the input (optional) */
	label?: string;
	/** Called with split parts and preformatted strings. If cleared, `parts` is null. */
	onChange: (
		parts: PickerValue | null,
		formatted?: DateChangeFormatted
	) => void;
	format?: 'year' | 'yearMonth' | 'yearMonthDay' | string | undefined;
	/** Position the popup above the input instead of below */
	positionAbove?: boolean;
	/** Optional formatter to display time as a label instead of HH:MM */
	timeLabelFormatter?: (
		hour?: string | null,
		minute?: string | null
	) => string | null | undefined;
	/** Option to hide the era selector */
	hideEraSelector?: boolean;
};

/* ---------------- helpers ---------------- */

const pad2 = (v: string | number | undefined) =>
	v === undefined || v === null || v === '' ? '' : String(v).padStart(2, '0');

const monthDays = (idx: number, ts?: TimeSystemConfig | null) => {
	const months = ts?.months;
	if (!months || months.length === 0) return 30; // safe fallback
	return idx >= 0 && idx < months.length ? months[idx]?.days ?? 30 : 30;
};

const sumMonthDays = (ts: TimeSystemConfig, upToIndex: number) =>
	(ts.months ?? [])
		.slice(0, Math.max(0, upToIndex))
		.reduce((a, m) => a + (m.days ?? 30), 0);

const useOutsideClose = (
	open: boolean,
	onClose: () => void,
	extraRefs: Array<React.RefObject<HTMLElement | null>> = []
) => {
	const ref = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		if (!open) return;
		const onClick = (e: MouseEvent) => {
			if (!ref.current) return;
			const target = e.target as Node;
			if (ref.current.contains(target)) return;
			if (extraRefs.some((extra) => extra.current?.contains(target))) return;
			onClose();
		};
		document.addEventListener('mousedown', onClick);
		return () => document.removeEventListener('mousedown', onClick);
		// `extraRefs` holds stable ref objects; dependencies omitted on purpose
	}, [open, onClose]);
	return ref;
};

/** Simple token formatter compatible with ts?.dateFormats */
const formatDateString = (
	ts: TimeSystemConfig | null | undefined,
	eraId: string,
	year: string,
	monthIndex: string,
	day: string,
	format: string | undefined
): string => {
	if (!ts || !format) return year || '';
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
					? String(monthNumber).padStart(2, '0')
					: '';
			case 'M':
				return month && monthNumber !== undefined
					? String(monthNumber)
					: '';
			case 'D^':
				return dayNum !== undefined ? ordinal(dayNum) : '';
			case 'DD':
				return dayNum !== undefined
					? String(dayNum).padStart(2, '0')
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

/**
 * Compute weekday (0..6) of the first day of a month.
 * Assumptions:
 * - Weeks have 7 days.
 * - Year 0, Month 0, Day 1 starts at `weekStartIndex` (default Monday = 0).
 * - Custom months lengths from ts.months are respected.
 */
function firstWeekdayOfMonth(
	yNum: number,
	mNum: number,
	ts?: TimeSystemConfig | null
): number {
	if (!ts) return 0;
	const weekStartIndex = (ts as any).weekStartIndex ?? 0; // 0=Mon default
	const daysPerYear =
		(ts.months ?? []).reduce((a, m) => a + (m.days ?? 30), 0) || 360;
	const prevYearsDays = (yNum || 0) * daysPerYear;
	const prevMonthsDays = sumMonthDays(ts, mNum);
	return (weekStartIndex + ((prevYearsDays + prevMonthsDays) % 7)) % 7;
}

/* ---------------- component ---------------- */

const DatePicker: React.FC<DatePickerProps> = ({
	ts,
	value,
	placeholder = 'Pick a date',
	clearable = false,
	label,
	onChange,
	format = 'yearMonthDay',
	positionAbove = false,
	timeLabelFormatter,
 	hideEraSelector = false,
}) => {
	const hasTS = !!(
		ts &&
		Array.isArray(ts.months) &&
		ts.months.length &&
		Array.isArray(ts.eras) &&
		ts.eras.length
	);

	// Local state mirrors the parts so the popup edits are controlled
	const [eraId, setEraId] = useState<string>(
		value?.eraId || (hasTS ? ts!.eras[0]?.id || '' : '')
	);
	const [year, setYear] = useState<string>(value?.year || '');
	const [monthIndex, setMonthIndex] = useState<string>(
		value?.monthIndex || '0'
	);
	const [day, setDay] = useState<string>(value?.day || '1');
	const [hour, setHour] = useState<string>(value?.hour ?? '');
	const [minute, setMinute] = useState<string>(value?.minute ?? '');
	const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
	const minutes = useMemo(() => [0, 15, 30, 45], []);

	// open/close popup
	const [open, setOpen] = useState(false);
	const anchorRef = useRef<HTMLDivElement | null>(null);
	const popRef = useOutsideClose(open, () => setOpen(false), [anchorRef]);
	const [portalPosition, setPortalPosition] = useState({ top: 0, left: 0 });
	const isBrowser = typeof window !== 'undefined';
	const [canPortal, setCanPortal] = useState(isBrowser);
	useEffect(() => {
		if (typeof window === 'undefined') return;
		setCanPortal(true);
	}, []);

	const repositionFloatingPanel = useCallback(() => {
		if (
			!anchorRef.current ||
			!popRef.current ||
			typeof window === 'undefined'
		)
			return;
		const anchorRect = anchorRef.current.getBoundingClientRect();
		const popupRect = popRef.current.getBoundingClientRect();
		const margin = 8;
		const scrollX = window.scrollX;
		const scrollY = window.scrollY;
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let top = positionAbove
			? anchorRect.top + scrollY - popupRect.height - margin
			: anchorRect.bottom + scrollY + margin;
		let left =
			anchorRect.left +
			anchorRect.width / 2 +
			scrollX -
			popupRect.width / 2;

		const minLeft = scrollX + margin;
		const maxLeft = scrollX + viewportWidth - popupRect.width - margin;
		left = Math.max(minLeft, Math.min(left, maxLeft));

		const minTop = scrollY + margin;
		const maxTop = scrollY + viewportHeight - popupRect.height - margin;
		top = Math.max(minTop, Math.min(top, maxTop));

		setPortalPosition({ top, left });
	}, [positionAbove]);

	useLayoutEffect(() => {
		if (!open || !canPortal) return;
		repositionFloatingPanel();
		const handle = () => repositionFloatingPanel();
		window.addEventListener('resize', handle);
		window.addEventListener('scroll', handle, true);
		return () => {
			window.removeEventListener('resize', handle);
			window.removeEventListener('scroll', handle, true);
		};
	}, [
		open,
		canPortal,
		repositionFloatingPanel,
		year,
		monthIndex,
		day,
		hour,
		minute,
		eraId,
		hideEraSelector,
	]);

	// React to parent value changes
	useEffect(() => {
		if (value == null) return;
		setEraId(value.eraId || (hasTS ? ts!.eras[0]?.id || '' : ''));
		setYear(value.year && /^\d+$/.test(value.year) ? value.year : '');
		setMonthIndex(value.monthIndex || '0');
		setDay(value.day || '1');
		setHour(value.hour ?? '');
		setMinute(value.minute ?? '');
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value?.eraId, value?.year, value?.monthIndex, value?.day]);

	// When TS becomes available later, seed missing defaults
	useEffect(() => {
		if (!hasTS) return;
		if (!eraId) setEraId(ts!.eras[0]?.id || '');
		if (monthIndex === '') setMonthIndex('0');
		if (day === '') setDay('1');
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hasTS]);

	// Display like your screenshot: Month + Year + Era. If TS missing, show year only.
	const display = useMemo(() => {
		if (!year || !/^\d+$/.test(year)) return '';
		const base = formatDateString(
			ts ?? null,
			eraId,
			year,
			monthIndex,
			day,
			format
				? (ts?.dateFormats as any)[format]
				: ts?.dateFormats?.yearMonth
		);
		if (hour !== '' || minute !== '') {
			const custom =
				typeof timeLabelFormatter === 'function'
					? timeLabelFormatter(hour, minute)
					: null;
			if (custom) return `${base} ${custom}`;
			const hh = pad2(hour || '0');
			const mm = pad2(minute || '0');
			return `${base} ${hh}:${mm}`;
		}
		return base;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ts, eraId, year, monthIndex, day, hour, minute, timeLabelFormatter]);

	// Emit parts + preformatted variants (if ts missing, we still return minimal)
	const emit = (parts: PickerValue | null) => {
		if (!parts) return onChange(null);
		if (!hasTS)
			return onChange(parts, {
				year: parts.year,
				yearMonth: parts.year,
				yearMonthDay: parts.year,
				time:
					parts.hour !== undefined || parts.minute !== undefined
						? `${pad2(parts.hour || '0')}:${pad2(
								parts.minute || '0'
						  )}`
						: undefined,
			});
		onChange(parts, {
			year: formatDateString(
				ts!,
				parts.eraId,
				parts.year,
				'',
				'',
				ts!.dateFormats?.year
			),
			yearMonth: formatDateString(
				ts!,
				parts.eraId,
				parts.year,
				parts.monthIndex,
				'',
				ts!.dateFormats?.yearMonth
			),
			yearMonthDay: formatDateString(
				ts!,
				parts.eraId,
				parts.year,
				parts.monthIndex,
				parts.day,
				ts!.dateFormats?.yearMonthDay
			),
			time:
				parts.hour !== undefined || parts.minute !== undefined
					? `${pad2(parts.hour || '0')}:${pad2(parts.minute || '0')}`
					: undefined,
		});
	};

	/* -------- month navigation -------- */
	const mLen = ts?.months?.length ?? 12;
	const yNum = parseInt(year || '0', 10) || 0;
	const mNum = Math.max(
		0,
		Math.min(mLen - 1, parseInt(monthIndex || '0', 10) || 0)
	);

	const gotoMonth = (y: number, m: number) => {
		const wrapM = ((m % mLen) + mLen) % mLen;
		const yAdj = y + Math.floor(m / mLen);
		setYear(String(yAdj));
		setMonthIndex(String(wrapM));
	};

	const prevMonth = () =>
		gotoMonth(yNum + (mNum - 1 < 0 ? -1 : 0), (mNum - 1 + mLen) % mLen);
	const nextMonth = () =>
		gotoMonth(yNum + (mNum + 1 >= mLen ? 1 : 0), (mNum + 1) % mLen);
	const prevYear = () => setYear(String(yNum - 1));
	const nextYear = () => setYear(String(yNum + 1));

	/* -------- grid with weekday offset & spill days -------- */
	const firstWd = hasTS ? firstWeekdayOfMonth(yNum, mNum, ts) : 0;
	const curDays = monthDays(mNum, ts);
	const prevIdx = (mNum - 1 + mLen) % mLen;
	const nextIdx = (mNum + 1) % mLen;
	const prevYearNum = mNum === 0 ? yNum - 1 : yNum;
	const nextYearNum = mNum === mLen - 1 ? yNum + 1 : yNum;
	const prevDaysInMonth = monthDays(prevIdx, ts);

	const leading = firstWd; // 0..6
	const cells: Array<{
		day: number;
		inMonth: -1 | 0 | 1;
		y: number;
		m: number;
	}> = [];

	// previous-month spill
	for (let i = 0; i < leading; i++) {
		const d = prevDaysInMonth - leading + 1 + i;
		cells.push({ day: d, inMonth: -1, y: prevYearNum, m: prevIdx });
	}

	// current month
	for (let d = 1; d <= curDays; d++)
		cells.push({ day: d, inMonth: 0, y: yNum, m: mNum });

	// next-month spill to complete 6 rows max (or at least finish the last row)
	const trailing = (7 - (cells.length % 7)) % 7;
	for (let i = 1; i <= trailing; i++) {
		cells.push({ day: i, inMonth: 1, y: nextYearNum, m: nextIdx });
	}

	// Weekday header (fallback)
	const weekShort = (ts as any)?.weekdaysShort as string[] | undefined;
	const weekRow =
		weekShort && weekShort.length === 7
			? weekShort
			: ['L', 'Ma', 'Me', 'G', 'V', 'S', 'D'];

	const disabled = !hasTS;
	const finalPlaceholder = disabled ? 'Time system not ready' : placeholder;
	const currentEra = useMemo(() => {
		if (!hasTS) return undefined;
		return ts!.eras.find((er) => er.id === eraId) ?? ts!.eras[0];
	}, [hasTS, ts, eraId]);

	return (
		<div className="datepick">
			{label && <div className="datepick__label">{label}</div>}

			<div
				className={`datepick__inputWrap${
					disabled ? ' is-disabled' : ''
				}`}
				ref={anchorRef}
			>
				<input
					className="modal__input datepill"
					onFocus={() => !disabled && setOpen(true)}
					onClick={() => !disabled && setOpen(true)}
					readOnly
					value={display}
					placeholder={finalPlaceholder}
					aria-haspopup="dialog"
					aria-expanded={open}
					aria-disabled={disabled}
				/>
				<span className="datepill__icon calendar" aria-hidden>
					<CalendarBlankIcon
						weight="bold"
						size={20}
						className="icon__hover gold_on_hover"
					/>
				</span>
				{clearable && display && !disabled && (
					<button
						type="button"
						className="datepill__icon-end"
						onClick={() => {
							setYear('');
							setDay('1');
							setHour('');
							setMinute('');
							onChange(null);
						}}
						aria-label="Clear date"
					>
						<XCircleIcon
							size={30}
							weight="bold"
							className="icon__hover dim_on_hover"
						/>
					</button>
				)}
			</div>

			{open &&
				hasTS &&
				canPortal &&
				anchorRef.current &&
				typeof document !== 'undefined' &&
				createPortal(
					<div
						ref={popRef}
						className="dp-pop dp-pop--floating"
						style={{
							top: portalPosition.top,
							left: portalPosition.left,
						}}
					>
						<div className="dp-pop__panel">
							{/* Header: nav + month select + year input + era select */}
							<div className="dp-pop__head">
								<button
									type="button"
									className="dp-pop__navbtn"
									onClick={prevYear}
									aria-label="Previous year"
								>
									<RewindIcon size={16} />
								</button>
								<button
									type="button"
									className="dp-pop__navbtn"
									onClick={prevMonth}
									aria-label="Previous month"
								>
									<CaretLeftIcon size={16} />
								</button>

								<div className="dp-pop__headmain">
									<select
										className="modal__select"
										value={String(mNum)}
										style={{ backgroundImage: 'none' }}
										onChange={(e) =>
											setMonthIndex(e.target.value)
										}
									>
										{ts!.months.map((m, i) => (
											<option key={m.id} value={String(i)}>
												{m.name}
											</option>
										))}
									</select>

									<input
										className="modal__input dp-pop__year"
										type="number"
										value={String(yNum)}
										onChange={(e) => setYear(e.target.value)}
										placeholder="Year"
									/>

									{hideEraSelector ? (
										<span className="dp-pop__eraChip">
											{currentEra?.abbreviation || ''}
										</span>
									) : (
										<select
											className="modal__select"
											value={eraId}
											style={{ backgroundImage: 'none' }}
											onChange={(e) => setEraId(e.target.value)}
										>
											{ts!.eras.map((er) => (
												<option key={er.id} value={er.id}>
													{er.abbreviation}
												</option>
											))}
										</select>
									)}
								</div>

								<button
									type="button"
									className="dp-pop__navbtn"
									onClick={nextMonth}
									aria-label="Next month"
								>
									<CaretRightIcon size={16} />
								</button>
								<button
									type="button"
									className="dp-pop__navbtn"
									onClick={nextYear}
									aria-label="Next year"
								>
									<FastForwardIcon size={16} />
								</button>
							</div>

							{/* Week row */}
							<div className="dp-pop__grid dp-pop__week">
								{weekRow.map((w) => (
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
										c.inMonth === 0 &&
										String(c.day) === day &&
										c.m === mNum &&
										String(yNum) === year;

									return (
										<button
											key={`${c.y}-${c.m}-${c.day}-${idx}`}
											type="button"
											className={`dp-pop__daybtn${
												isOutside ? ' is-outside' : ''
											}${isSelected ? ' is-selected' : ''}`}
											onClick={() => {
											setYear(String(c.y));
											setMonthIndex(String(c.m));
											setDay(String(c.day));
											emit({
												eraId,
												year: String(c.y),
												monthIndex: String(c.m),
												day: String(c.day),
												hour,
												minute,
											});
											setOpen(false);
										}}
									>
										{c.day}
									</button>
									);
								})}
							</div>

							{/* Time selection */}
							<div
								style={{
									display: 'flex',
									gap: '0.5rem',
									justifyContent: 'flex-end',
									marginTop: '0.75rem',
								}}
							>
								<select
									className="modal__select hour-select"
									value={hour}
									onChange={(e) => {
										const val = e.target.value;
										setHour(val);
										emit({
											eraId,
											year,
											monthIndex,
											day,
											hour: val,
											minute,
										});
									}}
								>
									<option value="">HH</option>
									{hours.map((h) => (
										<option key={h} value={String(h)}>
											{pad2(h)}
										</option>
									))}
								</select>
								<span style={{ alignSelf: 'center' }}>:</span>
								<select
									className="modal__select minute-select"
									value={minute}
									onChange={(e) => {
										const val = e.target.value;
										setMinute(val);
										emit({
											eraId,
											year,
											monthIndex,
											day,
											hour,
											minute: val,
										});
									}}
								>
									<option value="">MM</option>
									{minutes.map((m) => (
										<option key={m} value={String(m)}>
											{pad2(m)}
										</option>
									))}
								</select>
							</div>
						</div>
					</div>,
					document.body
				)}
		</div>
	);
};

export default DatePicker;
