import React, { useEffect, useMemo, useState } from 'react';
import Modal from 'react-modal';
import {
	DragDropContext,
	Droppable,
	Draggable,
	DropResult,
} from 'react-beautiful-dnd';
import ConfirmModal from './ConfirmModal';
import { Group } from '../types';
import { useAppStore } from '../store/appStore';

interface GroupModalProps {
	groups?: Group[]; // optional: if omitted, will use store groups
	onSave?: (data: Omit<Group, '_id'> & { _id?: string }) => void; // optional: if omitted, will call store actions
	onReorder?: (ordered: Group[]) => void; // optional: if omitted, will call store action
	onDelete?: (_id: string) => void; // optional: if omitted, will call store action
	onClose: () => void;
}

Modal.setAppElement('#root');

const GroupModal: React.FC<GroupModalProps> = ({
	groups,
	onSave,
	onReorder,
	onDelete,
	onClose,
}) => {
	// ---- Store fallbacks ----
	const storeGroups = useAppStore((s) => s.data.groups.data);
	const createGroup = useAppStore((s) => s.createGroup);
	const updateGroup = useAppStore((s) => s.updateGroup);
	const deleteGroupAction = useAppStore((s) => s.deleteGroup);
	const reorderGroups = useAppStore((s) => s.reorderGroups);
	const setGroupsFilter = useAppStore((s) => s.setGroupsFilter);
	const activeGroupIds = useAppStore((s) => s.ui.activeGroupIds);

	const sourceGroups = useMemo(
		() => groups ?? storeGroups,
		[groups, storeGroups]
	);

	// Local editable copy (sorted, non-mutating)
	const [localGroups, setLocalGroups] = useState<Group[]>(
		[...sourceGroups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
	);

	// For new group fields
	const [newName, setNewName] = useState('');
	const [newColor, setNewColor] = useState('#475569');

	// Keep local state in sync if source changes from outside
	useEffect(() => {
		setLocalGroups(
			[...sourceGroups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		);
	}, [sourceGroups]);

	// Handle drag end to reorder groups (local only; we persist on Apply)
	const handleDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		const items = Array.from(localGroups);
		const [moved] = items.splice(result.source.index, 1);
		items.splice(result.destination.index, 0, moved);
		const reordered = items.map((g, idx) => ({ ...g, order: idx }));
		setLocalGroups(reordered);
	};

	// Handle input change for group
	const updateGroupField = (
		_id: string,
		field: keyof Omit<Group, '_id' | 'order'>,
		value: string
	) => {
		setLocalGroups((prev) =>
			prev.map((g) =>
				g._id === _id ? ({ ...g, [field]: value } as Group) : g
			)
		);
	};

	// Persist all changes (update existing, reorder, create new)
	const handleApply = async () => {
		try {
			// Update existing groups (name/color/order) — always persist via store
			for (const g of localGroups) {
				await updateGroup({
					_id: g._id,
					name: g.name,
					order: g.order,
					color: g.color,
				});
				// Optionally notify parent, but persistence is handled here to avoid missing updates
				onSave?.({
					_id: g._id,
					name: g.name,
					color: g.color,
				} as any);
			}

			// Reorder persist
			if (onReorder) {
				onReorder(localGroups);
			} else {
				await reorderGroups(localGroups.map((g) => g._id));
				// opzionale: riallinea i filtri attivi allo stesso ordine
				const nextFilter = localGroups.map((g) => g._id);
				if (activeGroupIds.length) setGroupsFilter(nextFilter);
			}

			// Create new group if provided
			if (newName.trim()) {
				if (onSave) {
					onSave({ name: newName.trim(), color: newColor } as any);
				} else {
					await createGroup(newName.trim());
					// Se vuoi salvare anche il colore lato API, estendi createGroup({ name, color }) nello store/Api
				}
				setNewName('');
				setNewColor('#475569');
			}

			onClose();
		} catch (err) {
			// Qui puoi aggiungere un toast di errore
			// eslint-disable-next-line no-console
			console.error('Failed to apply group changes', err);
		}
	};

	// Delete group (immediate)
	const handleDelete = async (_id: string) => {
		try {
			if (onDelete) {
				onDelete(_id);
			} else {
				await deleteGroupAction(_id);
			}
			setLocalGroups((prev) => prev.filter((g) => g._id !== _id));
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Failed to delete group', err);
		}
	};
	
	// Delete group with confirmation
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
	const [pendingDeleteName, setPendingDeleteName] = useState<string>('');

	const requestDelete = (_id: string, name: string) => {
		setPendingDeleteId(_id);
		setPendingDeleteName(name);
		setConfirmOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!pendingDeleteId) return;
		try {
			if (onDelete) {
				onDelete(pendingDeleteId);
			} else {
				await deleteGroupAction(pendingDeleteId);
			}
			setLocalGroups((prev) => prev.filter((g) => g._id !== pendingDeleteId));
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Failed to delete group', err);
		} finally {
			setConfirmOpen(false);
			setPendingDeleteId(null);
			setPendingDeleteName('');
		}
	};

	return (
		<Modal
			isOpen={true}
			onRequestClose={onClose}
			contentLabel="Group Manager"
			className="modal__content"
			overlayClassName="modal__overlay"
		>
			<div className="modal__body">
				<div className="modal__body_content">
					<h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>
						Manage Groups
					</h2>
					<p
						style={{
							fontSize: '0.8rem',
							marginBottom: '1rem',
							color: '#94a3b8',
						}}
					>
						You can reorder groups by dragging, edit names and
						colours, or delete them. New groups can be added at the
						bottom.
					</p>
					<DragDropContext onDragEnd={handleDragEnd}>
						<Droppable droppableId="groups-droppable">
							{(provided) => (
								<div
									className="draggable__list"
									ref={provided.innerRef}
									{...provided.droppableProps}
								>
									{localGroups.map((group, index) => (
										<Draggable
											key={group._id}
											draggableId={group._id}
											index={index}
										>
											{(prov) => (
												<div
													ref={prov.innerRef}
													{...prov.draggableProps}
													className="draggable__listItem"
												>
													<span
														{...prov.dragHandleProps}
														className="draggable__handle"
													></span>
													<input
														type="text"
														value={group.name}
														onChange={(e) =>
															updateGroupField(
																group._id,
																'name',
																e.target.value
															)
														}
														className="draggable__input"
													/>
													<input
														type="color"
														value={
															(group as any).color
														}
														onChange={(e) =>
															updateGroupField(
																group._id,
																'color' as any,
																e.target.value
															)
														}
														style={{
															width: '36px',
															height: '36px',
															border: 'none',
														}}
													/>
													<button
														type="button"
														onClick={() => requestDelete(group._id, group.name)}
														className="draggable__iconbtn draggable__iconbtn--danger"
														title="Delete group"
													>
														✖
													</button>
		<ConfirmModal
			isOpen={confirmOpen}
			title="Delete Group"
			message={`Are you sure you want to delete "${pendingDeleteName}"?`}
			confirmText="Delete"
			variant="danger"
			onConfirm={handleConfirmDelete}
			onCancel={() => setConfirmOpen(false)}
		/>
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
					<div
						style={{
							marginTop: '1rem',
							borderTop: '1px solid #334155',
							padding: '.2rem',
						}}
					>
						<h3
							style={{ fontSize: '1rem', marginBottom: '0.5rem' }}
						>
							Add New Group
						</h3>
						<div style={{ display: 'flex', gap: '1.5rem' }}>
							<input
								type="text"
								placeholder="Group name"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								className="modal__input"
							/>
							<input
								type="color"
								value={newColor}
								onChange={(e) => setNewColor(e.target.value)}
								style={{
									width: '40px',
									height: '40px',
									border: 'none',
								}}
							/>
						</div>
					</div>
				</div>
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
						onClick={handleApply}
						className="draggable__btn draggable__btn--primary"
					>
						Save
					</button>
				</div>
			</div>
		</Modal>
	);
};

export default GroupModal;
