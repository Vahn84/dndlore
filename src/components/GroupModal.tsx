import React, { useState } from 'react';
import Modal from 'react-modal';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Group } from '../types';

interface GroupModalProps {
  groups: Group[];
  onSave: (data: Omit<Group, 'id'> & { id?: string }) => void;
  onReorder: (ordered: Group[]) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

Modal.setAppElement('#root');

const GroupModal: React.FC<GroupModalProps> = ({ groups, onSave, onReorder, onDelete, onClose }) => {
  // Local copy of groups for editing
  const [localGroups, setLocalGroups] = useState<Group[]>([...groups].sort((a, b) => a.order - b.order));
  // For new group fields
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#475569');

  // Handle drag end to reorder groups
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(localGroups);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    // update order numbers in local state only; will propagate on save
    const reordered = items.map((g, idx) => ({ ...g, order: idx }));
    setLocalGroups(reordered);
  };

  // Handle input change for group
  const updateGroupField = (id: string, field: keyof Omit<Group, 'id' | 'order'>, value: string) => {
    setLocalGroups(prev => prev.map(g => (g.id === id ? { ...g, [field]: value } : g)));
  };

  // Handle save (apply changes)
  const handleApply = () => {
    // Save or update existing groups
    localGroups.forEach(g => {
      onSave({ id: g.id, name: g.name, color: g.color } as any);
    });
    // Reorder groups
    onReorder(localGroups);
    // Add new group if any new name provided
    if (newName.trim()) {
      onSave({ name: newName.trim(), color: newColor } as any);
      setNewName('');
      setNewColor('#475569');
    }
    onClose();
  };

  // Delete group
  const handleDelete = (id: string) => {
    onDelete(id);
    setLocalGroups(prev => prev.filter(g => g.id !== id));
  };

  return (
    <Modal
      isOpen={true}
      onRequestClose={onClose}
      contentLabel="Group Manager"
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
          padding: '1rem',
          width: '400px',
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#f0f4fc',
        },
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>Manage Groups</h2>
      <p style={{ fontSize: '0.8rem', marginBottom: '1rem', color: '#94a3b8' }}>
        You can reorder groups by dragging, edit names and colours, or delete them. New groups can be added at the bottom.
      </p>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="groups-droppable">
          {provided => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {localGroups.map((group, index) => (
                <Draggable key={group.id} draggableId={group.id} index={index}>
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
                      <input
                        type="text"
                        value={group.name}
                        onChange={e => updateGroupField(group.id, 'name', e.target.value)}
                        style={{ flex: 1, background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px', padding: '0.25rem' }}
                      />
                      <input
                        type="color"
                        value={group.color}
                        onChange={e => updateGroupField(group.id, 'color', e.target.value)}
                        style={{ width: '36px', height: '36px', border: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleDelete(group.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1rem' }}
                        title="Delete group"
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
      {/* Add new group */}
      <div style={{ marginTop: '1rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Add New Group</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Group name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{ flex: 1, background: '#0f1724', color: '#f0f4fc', border: '1px solid #334155', borderRadius: '4px', padding: '0.4rem' }}
          />
          <input
            type="color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            style={{ width: '40px', height: '40px', border: 'none' }}
          />
        </div>
      </div>
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
          type="button"
          onClick={handleApply}
          style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
};

export default GroupModal;