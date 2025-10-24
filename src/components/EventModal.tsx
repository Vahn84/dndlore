import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import { Event, Group, TimeSystemConfig, Era, Month } from '../types';

interface EventModalProps {
  event: Event | null;
  groups: Group[];
  timeSystem: TimeSystemConfig;
  onSave: (data: Omit<Event, 'id'> & { id?: string }) => void;
  onClose: () => void;
}

// Set the root element for accessibility (required by react-modal)
Modal.setAppElement('#root');

const EventModal: React.FC<EventModalProps> = ({ event, groups, timeSystem, onSave, onClose }) => {
  // Local state for form fields
  const [title, setTitle] = useState(event?.title || '');
  const [groupId, setGroupId] = useState(event?.groupId || (groups[0]?.id ?? ''));
  const [description, setDescription] = useState(event?.description || '');
  const [color, setColor] = useState(
    event?.color || groups.find(g => g.id === (event?.groupId || groups[0]?.id))?.color || '#475569'
  );
  const [bannerUrl, setBannerUrl] = useState(event?.bannerUrl || '');
  // Hidden flag
  const [hidden, setHidden] = useState<boolean>(event?.hidden ?? false);

  // Date fields for start and end. We break the formatted date into its parts
  // using the provided time system configuration. If parsing fails, default to
  // the first era and current year 0 with no month/day.
  const parseDateString = (
    dateStr: string | undefined,
    ts: TimeSystemConfig
  ): { eraId: string; year: string; monthIndex: string; day: string } => {
    if (!dateStr) {
      return {
        eraId: ts.eras[0]?.id ?? '',
        year: '',
        monthIndex: '',
        day: '',
      };
    }
    // Attempt to find the era by abbreviation in the string
    let eraId = ts.eras[0]?.id ?? '';
    ts.eras.forEach(era => {
      if (dateStr.includes(era.abbreviation)) {
        eraId = era.id;
      }
    });
    // Extract the first number as year
    const yearMatch = dateStr.match(/(-?\d+)/);
    const year = yearMatch ? yearMatch[0] : '';
    // Find the month by matching month names
    let monthIndex: string = '';
    ts.months.forEach((m, idx) => {
      if (dateStr.includes(m.name)) {
        monthIndex = String(idx);
      }
    });
    // Extract day by matching ordinal or numeric day before month name
    let day = '';
    const dayMatch = dateStr.match(/(\d+)(?:st|nd|rd|th)?/);
    if (dayMatch) {
      day = dayMatch[1];
    }
    return { eraId, year, monthIndex, day };
  };

  // Initialize start and end date parts using the provided timeSystem
  const initialStart = parseDateString(event?.startDate, timeSystem);
  const initialEnd = parseDateString(event?.endDate, timeSystem);

  const [startEraId, setStartEraId] = useState(initialStart.eraId);
  const [startYear, setStartYear] = useState<string>(initialStart.year);
  const [startMonthIndex, setStartMonthIndex] = useState<string>(initialStart.monthIndex);
  const [startDay, setStartDay] = useState<string>(initialStart.day);

  const [endEnabled, setEndEnabled] = useState<boolean>(!!event?.endDate);
  const [endEraId, setEndEraId] = useState(initialEnd.eraId);
  const [endYear, setEndYear] = useState<string>(initialEnd.year);
  const [endMonthIndex, setEndMonthIndex] = useState<string>(initialEnd.monthIndex);
  const [endDay, setEndDay] = useState<string>(initialEnd.day);

  // Helper to format a date using the current time system formats. Only supports
  // replacing era abbreviation/name, year, month name/number, and day.
  const formatDateString = (
    eraId: string,
    year: string,
    monthIndex: string,
    day: string,
    format: string
  ): string => {
    const era = timeSystem.eras.find(e => e.id === eraId);
    const eraAbbr = era?.abbreviation ?? '';
    const eraName = era?.name ?? '';
    const monthIdxNum = monthIndex === '' ? -1 : parseInt(monthIndex, 10);
    const month = monthIdxNum >= 0 ? timeSystem.months[monthIdxNum] : undefined;
    const monthNumber = monthIdxNum >= 0 ? monthIdxNum + 1 : undefined;
    const monthName = month?.name ?? '';
    const dayNum = day ? parseInt(day, 10) : undefined;
    // Helper ordinal
    const ordinal = (n: number): string => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    let result = format;
    // Replace era codes first (E for abbreviation, EE for name)
    result = result.replace(/EE/g, eraName);
    result = result.replace(/E/g, eraAbbr);
    // Replace year codes (SYYYY not implemented separately; treat as YYYY)
    result = result.replace(/YYYY/g, year);
    result = result.replace(/YY/g, year.slice(-2));
    // Replace month codes
    if (month) {
      result = result.replace(/MMMM/g, monthName);
      result = result.replace(/MM/g, monthNumber!.toString().padStart(2, '0'));
      result = result.replace(/M/g, monthNumber!.toString());
    } else {
      // If month undefined, remove month tokens entirely
      result = result.replace(/MMMM|MMM|MM|M/g, '');
    }
    // Replace day codes
    if (dayNum !== undefined) {
      result = result.replace(/D\^/g, ordinal(dayNum));
      result = result.replace(/DD/g, dayNum.toString().padStart(2, '0'));
      result = result.replace(/D/g, dayNum.toString());
    } else {
      result = result.replace(/D\^|DDD|DD|D/g, '');
    }
    // Remove extra spaces and commas
    return result
      .replace(/\s+,/g, ',')
      .replace(/,\s*,/g, ',')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  // Update color when group changes (if no custom event color)
  useEffect(() => {
    if (!event || !event.color) {
      const selected = groups.find(g => g.id === groupId);
      if (selected) {
        setColor(selected.color);
      }
    }
  }, [groupId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          setBannerUrl(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Format the start and end date strings based on the selected values and time system
    let formattedStart = '';
    let formattedEnd: string | undefined = undefined;
    // Always require a year; convert to string
    const sYear = startYear.trim();
    if (sYear !== '') {
      // Determine which format to use. If month selected use yearMonthDay or yearMonth format; else year format
      if (startMonthIndex === '') {
        formattedStart = formatDateString(
          startEraId,
          sYear,
          '',
          '',
          timeSystem.dateFormats.year
        );
      } else {
        // month selected; include day if provided
        if (startDay !== '') {
          formattedStart = formatDateString(
            startEraId,
            sYear,
            startMonthIndex,
            startDay,
            timeSystem.dateFormats.yearMonthDay
          );
        } else {
          formattedStart = formatDateString(
            startEraId,
            sYear,
            startMonthIndex,
            '',
            timeSystem.dateFormats.yearMonth
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
            timeSystem.dateFormats.year
          );
        } else {
          if (endDay !== '') {
            formattedEnd = formatDateString(
              endEraId,
              eYear,
              endMonthIndex,
              endDay,
              timeSystem.dateFormats.yearMonthDay
            );
          } else {
            formattedEnd = formatDateString(
              endEraId,
              eYear,
              endMonthIndex,
              '',
              timeSystem.dateFormats.yearMonth
            );
          }
        }
      }
    }
    const data: Omit<Event, 'id'> & { id?: string } = {
      id: event?.id,
      groupId,
      title,
      startDate: formattedStart,
      endDate: formattedEnd,
      description,
      bannerUrl: bannerUrl || undefined,
      color,
      hidden,
    };
    onSave(data);
  };

  return (
    <Modal
      isOpen={true}
      onRequestClose={onClose}
      contentLabel="Event Editor"
      style={{
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 1000,
        },
        content: {
          top: '50%',
          left: '50%',
          right: 'auto',
          bottom: 'auto',
          marginRight: '-50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '1.5rem',
          width: '350px',
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#f0f4fc',
        },
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>{event ? 'Edit Event' : 'Create Event'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Group selection */}
        <label style={{ fontSize: '0.9rem' }}>
          Group
          <select
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
          >
            {groups
              .sort((a, b) => a.order - b.order)
              .map(g => (
                <option key={g.id} value={g.id} style={{ color: g.color }}>
                  {g.name}
                </option>
              ))}
          </select>
        </label>
        {/* Title */}
        <label style={{ fontSize: '0.9rem' }}>
          Title
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
            required
          />
        </label>
        {/* Start date selectors */}
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Start Date</legend>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Era */}
            <div style={{ flex: '0 0 45%' }}>
              <label style={{ fontSize: '0.8rem' }}>Era
                <select
                  value={startEraId}
                  onChange={e => setStartEraId(e.target.value)}
                  style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                >
                  {timeSystem.eras.map(era => (
                    <option key={era.id} value={era.id}>{era.abbreviation}</option>
                  ))}
                </select>
              </label>
            </div>
            {/* Year */}
            <div style={{ flex: '0 0 45%' }}>
              <label style={{ fontSize: '0.8rem' }}>Year
                <input
                  type="number"
                  value={startYear}
                  onChange={e => setStartYear(e.target.value)}
                  style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                  placeholder="9000"
                />
              </label>
            </div>
            {/* Month */}
            <div style={{ flex: '0 0 45%' }}>
              <label style={{ fontSize: '0.8rem' }}>Month
                <select
                  value={startMonthIndex}
                  onChange={e => setStartMonthIndex(e.target.value)}
                  style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                >
                  <option value="">-- none --</option>
                  {timeSystem.months.map((m, idx) => (
                    <option key={m.id} value={idx}>{m.name}</option>
                  ))}
                </select>
              </label>
            </div>
            {/* Day */}
            <div style={{ flex: '0 0 45%' }}>
              <label style={{ fontSize: '0.8rem' }}>Day
                <input
                  type="number"
                  value={startDay}
                  onChange={e => {
                    // ensure day does not exceed month length
                    const val = e.target.value;
                    const idx = startMonthIndex === '' ? -1 : parseInt(startMonthIndex, 10);
                    if (idx >= 0) {
                      const max = timeSystem.months[idx]?.days || 30;
                      if (val === '') {
                        setStartDay('');
                      } else if (/^\d+$/.test(val) && parseInt(val, 10) >= 1 && parseInt(val, 10) <= max) {
                        setStartDay(val);
                      }
                    } else {
                      setStartDay('');
                    }
                  }}
                  style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                  placeholder="1"
                  disabled={startMonthIndex === ''}
                />
              </label>
            </div>
          </div>
        </fieldset>
        {/* End date selectors */}
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>End Date</legend>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="checkbox"
              checked={endEnabled}
              onChange={e => setEndEnabled(e.target.checked)}
            />
            <span style={{ fontSize: '0.8rem' }}>Set end date</span>
          </div>
          {endEnabled && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Era */}
              <div style={{ flex: '0 0 45%' }}>
                <label style={{ fontSize: '0.8rem' }}>Era
                  <select
                    value={endEraId}
                    onChange={e => setEndEraId(e.target.value)}
                    style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                  >
                  {timeSystem.eras.map(era => (
                    <option key={era.id} value={era.id}>{era.abbreviation}</option>
                  ))}
                  </select>
                </label>
              </div>
              {/* Year */}
              <div style={{ flex: '0 0 45%' }}>
                <label style={{ fontSize: '0.8rem' }}>Year
                  <input
                    type="number"
                    value={endYear}
                    onChange={e => setEndYear(e.target.value)}
                    style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                    placeholder="8500"
                  />
                </label>
              </div>
              {/* Month */}
              <div style={{ flex: '0 0 45%' }}>
                <label style={{ fontSize: '0.8rem' }}>Month
                  <select
                    value={endMonthIndex}
                    onChange={e => setEndMonthIndex(e.target.value)}
                    style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                  >
                    <option value="">-- none --</option>
                    {timeSystem.months.map((m, idx) => (
                      <option key={m.id} value={idx}>{m.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              {/* Day */}
              <div style={{ flex: '0 0 45%' }}>
                <label style={{ fontSize: '0.8rem' }}>Day
                  <input
                    type="number"
                    value={endDay}
                    onChange={e => {
                      const val = e.target.value;
                      const idx = endMonthIndex === '' ? -1 : parseInt(endMonthIndex, 10);
                      if (idx >= 0) {
                        const max = timeSystem.months[idx]?.days || 30;
                        if (val === '') {
                          setEndDay('');
                        } else if (/^\d+$/.test(val) && parseInt(val, 10) >= 1 && parseInt(val, 10) <= max) {
                          setEndDay(val);
                        }
                      } else {
                        setEndDay('');
                      }
                    }}
                    style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                    placeholder="1"
                    disabled={endMonthIndex === ''}
                  />
                </label>
              </div>
            </div>
          )}
        </fieldset>
        {/* Color picker */}
        <label style={{ fontSize: '0.9rem' }}>
          Color
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            style={{ width: '100%', padding: '0.2rem', marginTop: '0.25rem', height: '2rem', background: '#0f1724', border: '1px solid #334155', borderRadius: '4px' }}
          />
        </label>
        {/* Description */}
        <label style={{ fontSize: '0.9rem' }}>
          Description
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px', minHeight: '80px' }}
          />
        </label>
        {/* Banner upload */}
        <label style={{ fontSize: '0.9rem' }}>
          Banner Image
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ width: '100%', marginTop: '0.25rem', color: '#f0f4fc' }}
          />
        </label>
        {bannerUrl && (
          <div style={{ marginTop: '0.5rem' }}>
            <img src={bannerUrl} alt="Banner preview" style={{ maxWidth: '100%', borderRadius: '4px' }} />
          </div>
        )}
        {/* Hidden toggle */}
        <label style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} />
          Hidden (DM only)
        </label>
        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', background: '#334155', color: '#f0f4fc', border: 'none', borderRadius: '4px' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }}
          >
            {event ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EventModal;