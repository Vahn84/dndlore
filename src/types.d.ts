export interface Group {
	_id: string;
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

type DetailLevel = 'Year' | 'Month' | 'Day';

export interface Event {
	_id: string;
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
	/** Thumbnail URL for list/timeline display */
	bannerThumbUrl?: string;
	color?: string;
	/**
	 * If true, this event will only be visible to editors (DMs).
	 */
	hidden?: boolean;
	/**
	 * Manual order position. If undefined the order will be computed from index.
	 */
	order?: number;
	startEraId?: string;
	startYear?: number;
	startMonthIndex?: number | null;
	startDay?: number | null;

	endEraId?: string;
	endYear?: number;
	endMonthIndex?: number | null;
	endDay?: number | null;
	detailLevel?: DetailLevel;
	icon?: string;
}

export interface PageBlock {
	type: 'rich' | 'image';
	// TipTap JSON
	rich?: any;
	// retro-compat (vecchi seed):
	plainText?: string;
	url?: string;
	hidden?: boolean;
}

export interface Page {
	_id: string;
	title: string;
	subtitle?: string;
	/** Type of lore page: place, history, myth, people or campaign. */
	type: 'place' | 'history' | 'myth' | 'people' | 'campaign';
	/** Optional banner image URL. */
	bannerUrl?: string;
	/** Optional banner thumbnail URL (for list display). */
	bannerThumbUrl?: string;
	/** Array of content blocks. */
	blocks: PageBlock[];
	/** Real-world session date for campaign pages (DD/MM/YYYY). */
	sessionDate?: string;
	/** In-world date for campaign pages (custom time system). */
	worldDate?: { eraId: string; year: number; monthIndex: number; day: number } | null;
	/** If true, the entire page is hidden from public users. */
	hidden?: boolean;
	/** If true, this page is a draft and not published yet. */
	draft?: boolean;
}

declare module './types' {
	interface Event {
		pageId?: string;
		linkSync?: boolean;
	}
}
