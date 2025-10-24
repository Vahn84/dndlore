
export interface Group {
	id: string;
	name: string;
	color: string;
	/**
	 * Manual ordering for the group list. Lower numbers appear first.
	 */
	order: number;
}

export interface Month {
	id: string;
	name: string;
	days: number;
}

export interface Weekday {
	id: string;
	name: string;
}

export interface Era {
	id: string;
	/**
	 * Short abbreviation used in formatted dates (e.g., "DE", "IE").
	 */
	abbreviation: string;
	/**
	 * Human‑readable name of the era (e.g., "Divine Era").
	 */
	name: string;
	/**
	 * The absolute start year of this era. Subsequent years in this era are relative to this value.
	 */
	startYear: number;
}

export interface TimeSystemConfig {
	name: string;
	months: Month[];
	weekdays: Weekday[];
	eras: Era[];
	hoursPerDay: number;
	minutesPerHour: number;
	/**
	 * Index of the weekday that marks the first day of year zero. 0 corresponds to the first element in weekdays.
	 */
	epochWeekday: number;
	/**
	 * If true, weekday numbering resets at the start of each month.
	 */
	weekdaysResetEachMonth: boolean;
	/**
	 * If true, eras start counting from year 0; otherwise year 1.
	 */
	erasStartOnZeroYear: boolean;
	/**
	 * Custom date format strings used when presenting dates. See Display settings for codes.
	 */
	dateFormats: {
		year: string;
		yearMonth: string;
		yearMonthDay: string;
		yearMonthDayTime: string;
	};
}

/**
 * Alias for TimeSystemConfig. In earlier versions the code referred to a `TimeSystem` type.  To
 * maintain backwards compatibility with those references we export TimeSystem as an alias.
 */
export type TimeSystem = TimeSystemConfig;

export interface EventDate {
	eraId: string;
	year: number;
	monthIndex: number;
	day: number;
}

export interface Event {
	id: string;
	groupId: string;
	title: string;
	/**
	 * Formatted start date string (e.g., "Pri 1st, 4629 IE").
	 */
	startDate: string;
	/**
	 * Formatted end date string. Optional.
	 */
	endDate?: string;
	description: string;
	bannerUrl?: string;
	color?: string;
	/**
	 * If true, this event will only be visible to editors (DMs).
	 */
	hidden?: boolean;
	/**
	 * Manual order position. If undefined the order will be computed from index.
	 */
	order?: number;
}
