import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { toast } from 'react-hot-toast';
import '../styles/RegionModal.scss';
import PagePickerModal from './PagePickerModal';
import { Page } from '../types';

interface RegionModalProps {
	isOpen: boolean;
	regionName?: string;
	borderColor?: string;
	fillColor?: string;
	linkedPageId?: string;
	onSave: (name: string, borderColor: string, fillColor: string, linkedPageId?: string) => void;
	onDelete?: () => void;
	onCancel: () => void;
	onColorChange?: (borderColor: string, fillColor: string) => void;
	onEditPolygon?: () => void;
	mode: 'create' | 'edit';
	// When provided, renders as a tooltip panel at viewport coordinates instead of a full overlay modal
	anchor?: { x: number; y: number };
}

const RegionModal: React.FC<RegionModalProps> = ({
	isOpen,
	regionName = '',
	borderColor = '#c9a96e',
	fillColor = 'rgba(201, 169, 110, 0.3)',
	linkedPageId,
	onSave,
	onDelete,
	onCancel,
    onColorChange,
	onEditPolygon,
	mode,
	anchor,
}) => {
	const [name, setName] = useState(regionName);
	const [border, setBorder] = useState(borderColor);
	const [fill, setFill] = useState(fillColor);
	const [linkedPage, setLinkedPage] = useState<string | undefined>(linkedPageId);
	const [pagePickerOpen, setPagePickerOpen] = useState(false);
	const panelRef = useRef<HTMLDivElement | null>(null);
	const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
	
	// Draggable state
	const [isDragging, setIsDragging] = useState(false);
	const dragRef = useRef<{ startX: number; startY: number } | null>(null);

	useEffect(() => {
		if (isOpen) {
			setName(regionName);
			setBorder(borderColor);
			setFill(fillColor);
			setLinkedPage(linkedPageId);
		}
	}, [isOpen, regionName, borderColor, fillColor, linkedPageId]);

	// Draggable handlers
	const handleMouseDown = (e: React.MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.closest('.region-modal h2')) {
			e.preventDefault();
			setIsDragging(true);
			const currentPos = tooltipPos || { top: anchor?.y || 0, left: anchor?.x || 0 };
			dragRef.current = {
				startX: e.clientX - currentPos.left,
				startY: e.clientY - currentPos.top,
			};
		}
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (isDragging && dragRef.current) {
			const newX = e.clientX - dragRef.current.startX;
			const newY = e.clientY - dragRef.current.startY;
			
			// Get modal dimensions
			const panel = panelRef.current;
			const panelRect = panel?.getBoundingClientRect();
			const panelW = panelRect?.width ?? 420;
			const panelH = panelRect?.height ?? 360;
			
			// Clamp to viewport
			const margin = 8;
			const clampedX = Math.max(margin, Math.min(newX, window.innerWidth - panelW - margin));
			const clampedY = Math.max(margin, Math.min(newY, window.innerHeight - panelH - margin));
			
			setTooltipPos({ left: clampedX, top: clampedY });
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
	}, [isDragging, tooltipPos]);

	// Do not early-return before hooks; we'll return null after hooks if closed

	const handleSave = () => {
		// If linked to a page, name is optional (will use page title)
		if (!linkedPage && !name.trim()) {
			toast.error('Region name is required (or link to an existing page)');
			return;
		}
		onSave(name.trim(), border, fill, linkedPage);
	};

	const handleBorderColorChange = (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		setBorder(e.target.value);
		onColorChange?.(e.target.value, fill);
	};

	const handleFillOpacityChange = (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const opacity = parseFloat(e.target.value);
		// Extract RGB from current fill color and update opacity
		const rgbMatch = fill.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (rgbMatch) {
			const [, r, g, b] = rgbMatch;
			const newFill = `rgba(${r}, ${g}, ${b}, ${opacity})`;
			setFill(newFill);
			onColorChange?.(border, newFill);
		}
	};

	const handleFillColorChange = (hexColor: string) => {
		// Convert hex to RGB
		const r = parseInt(hexColor.slice(1, 3), 16);
		const g = parseInt(hexColor.slice(3, 5), 16);
		const b = parseInt(hexColor.slice(5, 7), 16);
		// Extract current opacity
		const opacityMatch = fill.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
		const opacity = opacityMatch ? parseFloat(opacityMatch[1]) : 0.3;
		const newFill = `rgba(${r}, ${g}, ${b}, ${opacity})`;
		setFill(newFill);
		onColorChange?.(border, newFill);
	};

	// Extract current fill color as hex (without opacity)
	const getCurrentFillHex = () => {
		const rgbMatch = fill.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (rgbMatch) {
			const [, r, g, b] = rgbMatch;
			return `#${Number(r).toString(16).padStart(2, '0')}${Number(g)
				.toString(16)
				.padStart(2, '0')}${Number(b).toString(16).padStart(2, '0')}`;
		}
		return '#c9a96e';
	};

	// Extract current opacity
	const getCurrentOpacity = () => {
		const opacityMatch = fill.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
		return opacityMatch ? parseFloat(opacityMatch[1]) : 0.3;
	};

	const content = (
		<div className="region-modal" onClick={(e) => e.stopPropagation()}>
			<h2 
				style={{ 
					cursor: isDragging ? 'grabbing' : 'grab',
					userSelect: 'none',
				}}
				onMouseDown={handleMouseDown}
			>
				{mode === 'create' ? 'Create Region' : 'Edit Region'}
			</h2>

			{/* Page linking section */}
			<fieldset style={{ border: 'none', padding: 0, margin: '0 0 1rem 0' }}>
				<legend className="form-label" style={{ marginBottom: '0.5rem' }}>Link to Page</legend>
				<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
					{linkedPage ? (
						<>
							<span style={{ color: '#8ab4ff', fontSize: '0.9rem' }}>
								<i className="icon icli iconly-Link" style={{ marginRight: '0.25rem' }} />
								Page linked
							</span>
							<button
								type="button"
								className="btn-muted"
								onClick={() => setLinkedPage(undefined)}
								style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
							>
								Unlink
							</button>
						</>
					) : (
						<button 
							type="button" 
							className="btn-primary" 
							onClick={() => setPagePickerOpen(true)}
							style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
						>
							<i className="icon icli iconly-Calendar" /> Link Page
						</button>
					)}
				</div>
				{linkedPage && (
					<p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
						When linked, the region will use the page's title and be updated with map data.
					</p>
				)}
			</fieldset>

			<div className="form-group">
				<label htmlFor="region-name">Region Name {!linkedPage && '*'}</label>
				<input
					id="region-name"
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder={linkedPage ? "Optional (uses page title if empty)" : "Enter region name"}
					autoFocus={!linkedPage}
					disabled={!!linkedPage}
				/>
			</div>

			{/* Edit Polygon button - only shown in edit mode */}
			{mode === 'edit' && onEditPolygon && (
				<div className="form-group">
					<button 
						type="button"
						className="btn-edit-polygon" 
						onClick={onEditPolygon}
						style={{ 
							width: '100%',
							padding: '0.75rem',
							background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
							color: 'white',
							border: 'none',
							borderRadius: '4px',
							fontSize: '0.9rem',
							fontWeight: '600',
							cursor: 'pointer',
							transition: 'all 0.2s ease'
						}}
						onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
						onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
					>
						✏️ Edit Polygon Shape
					</button>
				</div>
			)}

			<div className="form-group">
				<label htmlFor="border-color">Border Color</label>
				<div className="color-input-group">
					<input
						id="border-color"
						type="color"
						value={border}
						onChange={handleBorderColorChange}
					/>
					<input
						type="text"
						value={border}
						onChange={handleBorderColorChange}
						placeholder="#c9a96e"
					/>
				</div>
			</div>

			<div className="form-group">
				<label htmlFor="fill-color">Fill Color</label>
				<div className="color-input-group">
					<input
						id="fill-color"
						type="color"
						value={getCurrentFillHex()}
						onChange={(e) =>
							handleFillColorChange(e.target.value)
						}
					/>
					<input
						type="text"
						value={getCurrentFillHex()}
						onChange={(e) =>
							handleFillColorChange(e.target.value)
						}
						placeholder="#c9a96e"
					/>
				</div>
			</div>

			<div className="form-group">
				<label htmlFor="fill-opacity">
					Fill Opacity: {getCurrentOpacity().toFixed(2)}
				</label>
				<input
					id="fill-opacity"
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={getCurrentOpacity()}
					onChange={handleFillOpacityChange}
				/>
			</div>

			<div className="preview-group">
				<label>Preview</label>
				<div
					className="color-preview"
					style={{
						border: `3px solid ${border}`,
						backgroundColor: fill,
					}}
				/>
			</div>

			<div className="modal-actions">
				{mode === 'edit' && onDelete && (
					<button className="btn-delete" onClick={onDelete}>
						Delete Region
					</button>
				)}
				<div className="modal-actions-right">
					<button className="btn-cancel" onClick={onCancel}>
						Cancel
					</button>
					<button className="btn-save" onClick={handleSave}>
						{mode === 'create' ? 'Create' : 'Save'}
					</button>
				</div>
			</div>
		</div>
	);

	// Always register click-outside, but only active in tooltip mode
	useEffect(() => {
		if (!anchor || !isOpen) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (!panelRef.current) return;
			if (!panelRef.current.contains(e.target as Node)) {
				onCancel();
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [anchor, isOpen, onCancel]);

	// Compute clamped tooltip position within viewport
	useLayoutEffect(() => {
		if (!anchor || !isOpen) {
			setTooltipPos(null);
			return;
		}
		// Slight offset from the cursor
		const offset = 12;
		// Measure panel size on next frame to ensure DOM is laid out
		const raf = requestAnimationFrame(() => {
			const panel = panelRef.current;
			const panelRect = panel?.getBoundingClientRect();
			const panelW = panelRect?.width ?? 420; // sensible default
			const panelH = panelRect?.height ?? 360; // sensible default
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const margin = 8;
			let left = anchor.x + offset;
			let top = anchor.y + offset;
			// Clamp within viewport
			if (left + panelW + margin > vw) left = Math.max(margin, vw - panelW - margin);
			if (top + panelH + margin > vh) top = Math.max(margin, vh - panelH - margin);
			// Ensure not negative
			left = Math.max(margin, left);
			top = Math.max(margin, top);
			setTooltipPos({ top, left });
		});
		return () => cancelAnimationFrame(raf);
	}, [anchor, isOpen, name, border, fill]);

	// After hooks: if not open, render nothing
	if (!isOpen) return null;

	const modalRoot = document.getElementById('modal-root');
	if (!modalRoot) return null;

	// Tooltip mode
	if (anchor) {
		return ReactDOM.createPortal(
			<>
				<div
					ref={panelRef}
					style={{
						position: 'fixed',
						top: tooltipPos?.top ?? anchor.y,
						left: tooltipPos?.left ?? anchor.x,
						zIndex: 2000,
					}}
				>
					{content}
				</div>
				<PagePickerModal
					isOpen={pagePickerOpen}
					onClose={() => setPagePickerOpen(false)}
					onSelect={(page: Page) => {
						setLinkedPage(page._id);
						setPagePickerOpen(false);
					}}
					placeholder="Search place pages..."
					filterType="place"
				/>
			</>,
			modalRoot
		);
	}

	// Fallback: classic centered modal with backdrop
	return ReactDOM.createPortal(
		<>
			<div className="region-modal-overlay" onClick={onCancel}>
				{content}
			</div>
			<PagePickerModal
				isOpen={pagePickerOpen}
				onClose={() => setPagePickerOpen(false)}
				onSelect={(page: Page) => {
					setLinkedPage(page._id);
					setPagePickerOpen(false);
				}}
				placeholder="Search place pages..."
				filterType="place"
			/>
		</>,
		modalRoot
	);
};

export default RegionModal;
