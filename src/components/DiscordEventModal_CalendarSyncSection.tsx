import React from 'react';

interface CalendarSyncSectionProps {
	syncToCalendar: boolean;
	setSyncToCalendar: (value: boolean) => void;
	calendarId: string;
	setCalendarId: (value: string) => void;
	calendars: Array<{ id: string; name: string; primary: boolean }>;
	isLoadingCalendars: boolean;
	calendarDropdownOpen: boolean;
	setCalendarDropdownOpen: (value: boolean) => void;
}

const CalendarSyncSection: React.FC<CalendarSyncSectionProps> = ({
	syncToCalendar,
	setSyncToCalendar,
	calendarId,
	setCalendarId,
	calendars,
	isLoadingCalendars,
	calendarDropdownOpen,
	setCalendarDropdownOpen,
}) => {
	return (
		<div className="form-group">
			<div className="checkbox-wrapper">
				<input
					className="input-checkbox input-checkbox-light"
					type="checkbox"
					id="hidden-calendar-checkbox"
					checked={syncToCalendar}
					onChange={(e) => {
						setSyncToCalendar(e.target.checked);
					}}
				/>

				<label
					className="input-checkbox-btn"
					htmlFor="hidden-calendar-checkbox"
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
											cal.id === calendarId
								  )?.name ||
								  'Select a calendar'}
							<span className="dropdown-arrow">
								▼
							</span>
						</button>
						{calendarDropdownOpen &&
							calendars.length > 0 && (
								<div className="dropdown-popup">
									{calendars.map(
										(cal) => (
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
												{
													cal.name
												}{' '}
												{cal.primary &&
													'(Primary)'}
											</div>
										)
									)}
								</div>
							)}
					</div>
				</div>
			)}
		</div>
	);
};

export default CalendarSyncSection;