import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import '../styles/PolygonEditModal.scss';

interface PolygonEditModalProps {
	isOpen: boolean;
	regionName: string;
	onSave: () => void;
	onCancel: () => void;
}

const PolygonEditModal: React.FC<PolygonEditModalProps> = ({
	isOpen,
	regionName,
	onSave,
	onCancel,
}) => {
	const [position, setPosition] = useState({ x: window.innerWidth - 250, y: 20 });
	const [isDragging, setIsDragging] = useState(false);
	const dragRef = useRef<{ startX: number; startY: number } | null>(null);
	const modalRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// Reset position when modal opens
		if (isOpen) {
			setPosition({ x: window.innerWidth - 250, y: 20 });
		}
	}, [isOpen]);

	const handleMouseDown = (e: React.MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.closest('.polygon-edit-modal-header')) {
			e.preventDefault();
			setIsDragging(true);
			dragRef.current = {
				startX: e.clientX - position.x,
				startY: e.clientY - position.y,
			};
		}
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (isDragging && dragRef.current) {
			setPosition({
				x: e.clientX - dragRef.current.startX,
				y: e.clientY - dragRef.current.startY,
			});
		}
	};

	const handleMouseUp = () => {
		setIsDragging(false);
		dragRef.current = null;
	};

	useEffect(() => {
		if (isDragging) {
			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('mouseup', handleMouseUp);
			return () => {
				window.removeEventListener('mousemove', handleMouseMove);
				window.removeEventListener('mouseup', handleMouseUp);
			};
		}
	}, [isDragging]);

	if (!isOpen) return null;

	const modalRoot = document.getElementById('modal-root');
	if (!modalRoot) return null;

	return ReactDOM.createPortal(
		<div
			ref={modalRef}
			className="polygon-edit-modal"
			style={{
				left: `${position.x}px`,
				top: `${position.y}px`,
				cursor: isDragging ? 'grabbing' : 'grab',
			}}
			onMouseDown={handleMouseDown}
		>
			<div className="polygon-edit-modal-header">
				<h4>Editing: {regionName}</h4>
			</div>
			<div className="polygon-edit-modal-body">
				<p>Drag the control points to reshape the region</p>
			</div>
			<div className="polygon-edit-modal-actions">
				<button className="btn-cancel" onClick={onCancel}>
					Cancel
				</button>
				<button className="btn-save" onClick={onSave}>
					Save Polygon
				</button>
			</div>
		</div>,
		modalRoot
	);
};

export default PolygonEditModal;
