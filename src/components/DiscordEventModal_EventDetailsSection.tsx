import React from "react";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import SessionDatePicker from "./SessionDatePicker";
import CalendarSyncSection from "./DiscordEventModal_CalendarSyncSection";

interface EventDetailsSectionProps {
  title: string;
  setTitle: (value: string) => void;
  bannerUrl: string;
  setBannerUrl: (value: string) => void;
  resolveAssetUrl: (url: string) => string;
  dateStr: string | null;
  setDateStr: (value: string | null) => void;
  hour: string;
  setHour: (value: string) => void;
  minute: string;
  setMinute: (value: string) => void;
  syncToCalendar: boolean;
  setSyncToCalendar: (value: boolean) => void;
  calendarId: string;
  setCalendarId: (value: string) => void;
  calendars: { id: string; name: string; primary: boolean; }[];
  isLoadingCalendars: boolean;
  calendarDropdownOpen: boolean;
  setCalendarDropdownOpen: (value: boolean) => void;
  openAssetManager: (value: boolean) => void;
}

const EventDetailsSection: React.FC<EventDetailsSectionProps> = ({
  title,
  setTitle,
  bannerUrl,
  setBannerUrl,
  resolveAssetUrl,
  dateStr,
  setDateStr,
  hour,
  setHour,
  minute,
  setMinute,
  syncToCalendar,
  setSyncToCalendar,
  calendarId,
  setCalendarId,
  calendars,
  isLoadingCalendars,
  calendarDropdownOpen,
  setCalendarDropdownOpen,
  openAssetManager,
}) => {
  return (
    <div className="modal__column modal__column--left">
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
              onClick={() => setBannerUrl("")}
              title="Remove image"
            >
              <TrashIcon color="white" size={18} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="draggable__btn"
            onClick={() => {
              openAssetManager(true);
            }}
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
            wrapperClassName="align-left"
          />
          <div className="time-fields">
            <select
              className="modal__select"
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              aria-label="Hours"
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <option key={i} value={String(i).padStart(2, "0")}>
                  {String(i).padStart(2, "0")}
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
                  <option key={mm} value={String(mm).padStart(2, "0")}>
                    {String(mm).padStart(2, "0")}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>
      {/* Calendar Sync Section */}
      <CalendarSyncSection
        syncToCalendar={syncToCalendar}
        setSyncToCalendar={setSyncToCalendar}
        calendarId={calendarId}
        setCalendarId={setCalendarId}
        calendars={calendars}
        isLoadingCalendars={isLoadingCalendars}
        calendarDropdownOpen={calendarDropdownOpen}
        setCalendarDropdownOpen={setCalendarDropdownOpen}
      />
    </div>
  );
};

export default EventDetailsSection;
