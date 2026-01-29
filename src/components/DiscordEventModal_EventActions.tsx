import React from 'react';

interface EventActionsProps {
	isCreating: boolean;
	onCancel: () => void;
	onCreate: () => void;
}

const EventActions: React.FC<EventActionsProps> = ({
	isCreating,
	onCancel,
	onCreate,
}) => {
	return (
		<div
			className="modal__actions"
			style={{ marginTop: '0' }}
		>
			<button
				type="button"
				className="modal__btn cancel btn-muted"
				onClick={onCancel}
				disabled={isCreating}
			>
				Cancel
			</button>
			<button
				type="button"
				className="modal__btn btn-primary"
				onClick={onCreate}
				disabled={isCreating}
			>
				{isCreating ? 'Creating...' : 'Create Event'}
			</button>
		</div>
	);
};

export default EventActions;
