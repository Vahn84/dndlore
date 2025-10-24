import React, { useState } from 'react';
import Modal from 'react-modal';
import {
  TimeSystemConfig,
  Month,
  Weekday,
  Era,
} from '../types';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

interface TimeSystemModalProps {
  timeSystem: TimeSystemConfig;
  onSave: (ts: TimeSystemConfig) => void;
  onClose: () => void;
}

Modal.setAppElement('#root');

// Helper to generate a short random ID. This replicates the generateId helper used elsewhere.
const generateId = () => Math.random().toString(36).slice(2, 9);

const TimeSystemModal: React.FC<TimeSystemModalProps> = ({ timeSystem, onSave, onClose }) => {
  // Work on a local copy so changes do not propagate until saved
  const [localTS, setLocalTS] = useState<TimeSystemConfig>({
    name: timeSystem.name,
    months: [...timeSystem.months],
    weekdays: [...timeSystem.weekdays],
    eras: [...timeSystem.eras],
    hoursPerDay: timeSystem.hoursPerDay,
    minutesPerHour: timeSystem.minutesPerHour,
    epochWeekday: timeSystem.epochWeekday,
    weekdaysResetEachMonth: timeSystem.weekdaysResetEachMonth,
    erasStartOnZeroYear: timeSystem.erasStartOnZeroYear,
    dateFormats: { ...timeSystem.dateFormats },
  });

  // Active tab for editing. Options: overview, months, weekdays, eras, formats
  const [activeTab, setActiveTab] = useState<'overview' | 'months' | 'weekdays' | 'eras' | 'formats'>('overview');

  // Handlers to update individual fields
  const updateMonthField = (id: string, field: keyof Month, value: any) => {
    setLocalTS(prev => ({
      ...prev,
      months: prev.months.map(m => (m.id === id ? { ...m, [field]: value } : m)),
    }));
  };

  const addMonth = () => {
    setLocalTS(prev => ({
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
    setLocalTS(prev => ({
      ...prev,
      months: prev.months.filter(m => m.id !== id),
    }));
  };

  const onMonthsDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(localTS.months);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setLocalTS(prev => ({ ...prev, months: items }));
  };

  // Weekday handlers
  const updateWeekdayField = (id: string, value: string) => {
    setLocalTS(prev => ({
      ...prev,
      weekdays: prev.weekdays.map(d => (d.id === id ? { ...d, name: value } : d)),
    }));
  };

  const addWeekday = () => {
    setLocalTS(prev => ({
      ...prev,
      weekdays: [
        ...prev.weekdays,
        {
          id: generateId(),
          name: `Day ${prev.weekdays.length + 1}`,
        },
      ],
    }));
  };

  const deleteWeekday = (id: string) => {
    setLocalTS(prev => ({
      ...prev,
      weekdays: prev.weekdays.filter(d => d.id !== id),
    }));
  };

  const onWeekdaysDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(localTS.weekdays);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    // Compute new epochWeekday index based on original day id
    const oldEpochId = localTS.weekdays[localTS.epochWeekday]?.id;
    const newEpochIndex = items.findIndex(d => d.id === oldEpochId);
    setLocalTS(prev => ({ ...prev, weekdays: items, epochWeekday: newEpochIndex >= 0 ? newEpochIndex : 0 }));
  };

  // Era handlers
  const updateEraField = (id: string, field: keyof Era, value: any) => {
    setLocalTS(prev => ({
      ...prev,
      eras: prev.eras.map(e => (e.id === id ? { ...e, [field]: value } : e)),
    }));
  };

  const addEra = () => {
    setLocalTS(prev => ({
      ...prev,
      eras: [
        ...prev.eras,
        {
          id: generateId(),
          abbreviation: `E${prev.eras.length + 1}`,
          name: `Era ${prev.eras.length + 1}`,
          startYear: 0,
        },
      ],
    }));
  };

  const deleteEra = (id: string) => {
    setLocalTS(prev => ({
      ...prev,
      eras: prev.eras.filter(e => e.id !== id),
    }));
  };

  const onErasDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(localTS.eras);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setLocalTS(prev => ({ ...prev, eras: items }));
  };

  // Handler for saving changes
  const handleSave = () => {
    // Normalize epochWeekday to be within range
    const epoch = Math.min(Math.max(localTS.epochWeekday, 0), localTS.weekdays.length - 1);
    onSave({ ...localTS, epochWeekday: epoch });
  };

  return (
    <Modal
      isOpen={true}
      onRequestClose={onClose}
      contentLabel="Time System Editor"
      style={{
        overlay: {
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 1000,
        },
        content: {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '1rem 0',
          width: '640px',
          maxHeight: '90vh',
          overflow: 'hidden',
          color: '#f0f4fc',
          display: 'flex',
        },
      }}
    >
      {/* Left navigation */}
      <div style={{ width: '180px', borderRight: '1px solid #334155', padding: '0 1rem' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', marginBottom: '0.5rem' }}>Time System Editor</h3>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            style={{
              textAlign: 'left',
              background: activeTab === 'overview' ? '#334155' : 'transparent',
              border: 'none',
              color: '#f0f4fc',
              padding: '0.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            style={{
              textAlign: 'left',
              background: activeTab === 'months' ? '#334155' : 'transparent',
              border: 'none',
              color: '#f0f4fc',
              padding: '0.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('months')}
          >
            Months
          </button>
          <button
            style={{
              textAlign: 'left',
              background: activeTab === 'weekdays' ? '#334155' : 'transparent',
              border: 'none',
              color: '#f0f4fc',
              padding: '0.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('weekdays')}
          >
            Weekdays
          </button>
          <button
            style={{
              textAlign: 'left',
              background: activeTab === 'eras' ? '#334155' : 'transparent',
              border: 'none',
              color: '#f0f4fc',
              padding: '0.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('eras')}
          >
            Years / Eras
          </button>
          <button
            style={{
              textAlign: 'left',
              background: activeTab === 'formats' ? '#334155' : 'transparent',
              border: 'none',
              color: '#f0f4fc',
              padding: '0.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('formats')}
          >
            Settings
          </button>
        </nav>
      </div>
      {/* Content area */}
      <div style={{ flex: 1, padding: '0 1rem', overflowY: 'auto' }}>
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Overview</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: '0 0 45%' }}>
                <label style={{ fontSize: '0.85rem' }}>Name
                  <input
                    type="text"
                    value={localTS.name}
                    onChange={e => setLocalTS(prev => ({ ...prev, name: e.target.value }))}
                    style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                  />
                </label>
              </div>
              <div style={{ flex: '0 0 45%' }}>
                <label style={{ fontSize: '0.85rem' }}>Hours per day
                  <input
                    type="number"
                    value={localTS.hoursPerDay}
                    min={1}
                    onChange={e => setLocalTS(prev => ({ ...prev, hoursPerDay: parseInt(e.target.value, 10) || prev.hoursPerDay }))}
                    style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                  />
                </label>
              </div>
              <div style={{ flex: '0 0 45%' }}>
                <label style={{ fontSize: '0.85rem' }}>Minutes per hour
                  <input
                    type="number"
                    value={localTS.minutesPerHour}
                    min={1}
                    onChange={e => setLocalTS(prev => ({ ...prev, minutesPerHour: parseInt(e.target.value, 10) || prev.minutesPerHour }))}
                    style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                  />
                </label>
              </div>
              <div style={{ flex: '0 0 45%' }}>
                <label style={{ fontSize: '0.85rem' }}>Epoch weekday
                  <select
                    value={localTS.epochWeekday}
                    onChange={e => setLocalTS(prev => ({ ...prev, epochWeekday: parseInt(e.target.value, 10) }))}
                    style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                  >
                    {localTS.weekdays.map((d, idx) => (
                      <option key={d.id} value={idx}>{d.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ flex: '0 0 45%' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={localTS.weekdaysResetEachMonth}
                    onChange={e => setLocalTS(prev => ({ ...prev, weekdaysResetEachMonth: e.target.checked }))}
                  />
                  Weekday numbering resets each month
                </label>
              </div>
              <div style={{ flex: '0 0 45%' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={localTS.erasStartOnZeroYear}
                    onChange={e => setLocalTS(prev => ({ ...prev, erasStartOnZeroYear: e.target.checked }))}
                  />
                  Eras start on year 0 (otherwise year 1)
                </label>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'months' && (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Months</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Reorder months by dragging the handle. You can rename each month and set the number of days it contains.</p>
            <DragDropContext onDragEnd={onMonthsDragEnd}>
              <Droppable droppableId="months-droppable">
                {provided => (
                  <div ref={provided.innerRef} {...provided.droppableProps}>
                    {localTS.months.map((m, index) => (
                      <Draggable key={m.id} draggableId={m.id} index={index}>
                        {prov => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginBottom: '0.5rem',
                              padding: '0.5rem',
                              background: '#0f1724',
                              borderRadius: '4px',
                              border: '1px solid #334155',
                              ...prov.draggableProps.style,
                            }}
                          >
                            <span {...prov.dragHandleProps} style={{ cursor: 'grab', color: '#94a3b8' }}>☰</span>
                            <span style={{ width: '24px', color: '#cbd5e1' }}>{index + 1}</span>
                            <input
                              type="text"
                              value={m.name}
                              onChange={e => updateMonthField(m.id, 'name', e.target.value)}
                              style={{ flex: 1, background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px', padding: '0.25rem' }}
                            />
                              <input
                                type="number"
                                min={1}
                                value={m.days}
                                onChange={e => updateMonthField(m.id, 'days', parseInt(e.target.value, 10) || 1)}
                                style={{ width: '60px', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px', padding: '0.25rem' }}
                              />
                            <button
                              type="button"
                              onClick={() => deleteMonth(m.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1rem' }}
                              title="Delete month"
                            >
                              ✖
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            <button
              type="button"
              onClick={addMonth}
              style={{ marginTop: '1rem', padding: '0.4rem 0.8rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }}
            >
              + Add month
            </button>
          </div>
        )}
        {activeTab === 'weekdays' && (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Weekdays</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Reorder weekdays by dragging. Rename them or remove/add new ones. Select which weekday marks the start of year zero.</p>
            <DragDropContext onDragEnd={onWeekdaysDragEnd}>
              <Droppable droppableId="weekdays-droppable">
                {provided => (
                  <div ref={provided.innerRef} {...provided.droppableProps}>
                    {localTS.weekdays.map((d, index) => (
                      <Draggable key={d.id} draggableId={d.id} index={index}>
                        {prov => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginBottom: '0.5rem',
                              padding: '0.5rem',
                              background: '#0f1724',
                              borderRadius: '4px',
                              border: '1px solid #334155',
                              ...prov.draggableProps.style,
                            }}
                          >
                            <span {...prov.dragHandleProps} style={{ cursor: 'grab', color: '#94a3b8' }}>☰</span>
                            <span style={{ width: '24px', color: '#cbd5e1' }}>{index + 1}</span>
                            <input
                              type="text"
                              value={d.name}
                              onChange={e => updateWeekdayField(d.id, e.target.value)}
                              style={{ flex: 1, background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px', padding: '0.25rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => deleteWeekday(d.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1rem' }}
                              title="Delete day"
                            >
                              ✖
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            <button
              type="button"
              onClick={addWeekday}
              style={{ marginTop: '1rem', padding: '0.4rem 0.8rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }}
            >
              + Add weekday
            </button>
          </div>
        )}
        {activeTab === 'eras' && (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Years / Eras</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Define time eras. Each era requires a unique abbreviation, a name and an absolute start year. Drag to reorder eras. The first era is considered the reference era.</p>
            <DragDropContext onDragEnd={onErasDragEnd}>
              <Droppable droppableId="eras-droppable">
                {provided => (
                  <div ref={provided.innerRef} {...provided.droppableProps}>
                    {localTS.eras.map((er, index) => (
                      <Draggable key={er.id} draggableId={er.id} index={index}>
                        {prov => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginBottom: '0.5rem',
                              padding: '0.5rem',
                              background: '#0f1724',
                              borderRadius: '4px',
                              border: '1px solid #334155',
                              ...prov.draggableProps.style,
                            }}
                          >
                            <span {...prov.dragHandleProps} style={{ cursor: 'grab', color: '#94a3b8' }}>☰</span>
                            <span style={{ width: '24px', color: '#cbd5e1' }}>{index + 1}</span>
                            <input
                              type="text"
                              value={er.abbreviation}
                              onChange={e => updateEraField(er.id, 'abbreviation', e.target.value)}
                              style={{ width: '60px', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px', padding: '0.25rem' }}
                              placeholder="Abbr"
                            />
                            <input
                              type="text"
                              value={er.name}
                              onChange={e => updateEraField(er.id, 'name', e.target.value)}
                              style={{ flex: 1, background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px', padding: '0.25rem' }}
                              placeholder="Era name"
                            />
                            <input
                              type="number"
                              value={er.startYear}
                              onChange={e => updateEraField(er.id, 'startYear', parseInt(e.target.value, 10) || 0)}
                              style={{ width: '80px', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px', padding: '0.25rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => deleteEra(er.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1rem' }}
                              title="Delete era"
                            >
                              ✖
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            <button
              type="button"
              onClick={addEra}
              style={{ marginTop: '1rem', padding: '0.4rem 0.8rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }}
            >
              + Add era
            </button>
          </div>
        )}
        {activeTab === 'formats' && (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Customize date display</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Define how your dates are formatted. Use the codes listed to include era names, years, months and days.</p>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 300px' }}>
                <label style={{ fontSize: '0.8rem' }}>Year
                  <input
                    type="text"
                    value={localTS.dateFormats.year}
                    onChange={e => setLocalTS(prev => ({ ...prev, dateFormats: { ...prev.dateFormats, year: e.target.value } }))}
                    style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                  />
                </label>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>Example: {localTS.dateFormats.year.replace(/YYYY/g, '4629').replace(/E/g, localTS.eras[0]?.abbreviation || '')}</div>
                <label style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Year Month
                  <input
                    type="text"
                    value={localTS.dateFormats.yearMonth}
                    onChange={e => setLocalTS(prev => ({ ...prev, dateFormats: { ...prev.dateFormats, yearMonth: e.target.value } }))}
                    style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                  />
                </label>
                <label style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Year Month Day
                  <input
                    type="text"
                    value={localTS.dateFormats.yearMonthDay}
                    onChange={e => setLocalTS(prev => ({ ...prev, dateFormats: { ...prev.dateFormats, yearMonthDay: e.target.value } }))}
                    style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                  />
                </label>
                <label style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Year Month Day Time
                  <input
                    type="text"
                    value={localTS.dateFormats.yearMonthDayTime}
                    onChange={e => setLocalTS(prev => ({ ...prev, dateFormats: { ...prev.dateFormats, yearMonthDayTime: e.target.value } }))}
                    style={{ width: '100%', padding: '0.3rem', marginTop: '0.25rem', background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px' }}
                  />
                </label>
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h4 style={{ fontSize: '0.9rem', marginTop: 0 }}>Display codes</h4>
                <ul style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                  <li><code>E</code> – Era abbreviation</li>
                  <li><code>EE</code> – Era name</li>
                  <li><code>YYYY</code> – Year (4 digits)</li>
                  <li><code>YY</code> – Year (2 digits)</li>
                  <li><code>MMMM</code> – Month name</li>
                  <li><code>MM</code> – Month number (2 digits)</li>
                  <li><code>M</code> – Month number</li>
                  <li><code>D^</code> – Day with ordinal (e.g., 1st, 2nd)</li>
                  <li><code>DD</code> – Day (2 digits)</li>
                  <li><code>D</code> – Day</li>
                  <li>Text in square brackets like [Text] is ignored</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        {/* Actions at bottom right */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', paddingBottom: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', background: '#334155', color: '#f0f4fc', border: 'none', borderRadius: '4px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TimeSystemModal;