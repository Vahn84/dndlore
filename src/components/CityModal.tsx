import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { toast } from 'react-hot-toast';
import '../styles/RegionModal.scss'; // Reuse the same styles
import AssetsManagerModal from './AssetsManagerModal';
import PagePickerModal from './PagePickerModal';
import { useAppStore } from '../store/appStore';
import { Page } from '../types';
import Api from '../Api';

interface CityModalProps {
	isOpen: boolean;
	cityName?: string;
	borderColor?: string;
	fillColor?: string;
	assetId?: string;
	linkedPageId?: string;
	onSave: (
		name: string,
		borderColor: string,
		fillColor: string,
		assetId?: string,
		linkedPageId?: string
	) => void;
	onDelete?: () => void;
	onCancel: () => void;
	mode: 'create' | 'edit';
	anchor?: { x: number; y: number };
}

const CityModal: React.FC<CityModalProps> = ({
	isOpen,
	cityName = '',
	borderColor = '#c9a96e',
	fillColor = 'rgba(201, 169, 110, 0.3)',
	assetId,
	linkedPageId,
	onSave,
	onDelete,
	onCancel,
	mode,
	anchor,
}) => {
	const [name, setName] = useState(cityName);
	const [border, setBorder] = useState(borderColor);
	const [fill, setFill] = useState(fillColor);
	const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(
		assetId
	);
	const [selectedAssetUrl, setSelectedAssetUrl] = useState<
		string | undefined
	>(undefined);
	const [linkedPage, setLinkedPage] = useState<string | undefined>(
		linkedPageId
	);
	const [linkedPageTitle, setLinkedPageTitle] = useState<string>('');
	const [assetManagerOpen, setAssetManagerOpen] = useState(false);
	const [pagePickerOpen, setPagePickerOpen] = useState(false);
	const panelRef = useRef<HTMLDivElement | null>(null);
	const [tooltipPos, setTooltipPos] = useState<{
		top: number;
		left: number;
	} | null>(null);
	
	// Draggable state
	const [isDragging, setIsDragging] = useState(false);
	const dragRef = useRef<{ startX: number; startY: number } | null>(null);

	// Get assets from store
	const assets = useAppStore((s) => s.data.assets.data);
	const loadAssets = useAppStore((s) => s.loadAssets);
	const pages = useAppStore((s) => s.data.pages.data);

	useEffect(() => {
		if (isOpen) {
			setName(cityName);
			setBorder(borderColor);
			setFill(fillColor);
			setSelectedAssetId(assetId);
			setSelectedAssetUrl(undefined); // Will be loaded below if assetId exists
			setLinkedPage(linkedPageId);
			setLinkedPageTitle('');

			// Load assets if not already in store
			if (assets.length === 0) {
				loadAssets();
			}

			// Load linked page title from store if linkedPageId is provided
			if (linkedPageId) {
				const page = pages.find((p) => p._id === linkedPageId);
				if (page && page.title) {
					setLinkedPageTitle(page.title);
					setName(page.title);
				}
			}

			// Load asset URL from store if assetId is provided
			if (assetId && assets.length > 0) {
				const asset = assets.find((a) => a._id === assetId);
				if (asset) {
					setSelectedAssetUrl(asset.url);
				}
			}
		}
	}, [isOpen, cityName, borderColor, fillColor, assetId, linkedPageId, anchor, assets, loadAssets, pages]);

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
			const panelH = panelRect?.height ?? 500;
			
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

	const handleSave = () => {
		// If linked to a page, name is taken from page; otherwise require a name
		if (!linkedPage && !name.trim()) {
			toast.error('City name is required (or link to an existing page)');
			return;
		}
		onSave(name.trim(), border, fill, selectedAssetId, linkedPage);
	};

	const handleBorderColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setBorder(e.target.value);
	};

	const handleFillOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const opacity = parseFloat(e.target.value);
		const rgbMatch = fill.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (rgbMatch) {
			const [, r, g, b] = rgbMatch;
			const newFill = `rgba(${r}, ${g}, ${b}, ${opacity})`;
			setFill(newFill);
		}
	};

	const handleFillColorChange = (hexColor: string) => {
		const r = parseInt(hexColor.slice(1, 3), 16);
		const g = parseInt(hexColor.slice(3, 5), 16);
		const b = parseInt(hexColor.slice(5, 7), 16);
		const opacityMatch = fill.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
		const opacity = opacityMatch ? parseFloat(opacityMatch[1]) : 0.3;
		const newFill = `rgba(${r}, ${g}, ${b}, ${opacity})`;
		setFill(newFill);
	};

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

	const getCurrentOpacity = () => {
		const opacityMatch = fill.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
		return opacityMatch ? parseFloat(opacityMatch[1]) : 0.3;
	};

	const handleAssetSelect = (asset: { _id: string; url: string }) => {
		setSelectedAssetId(asset._id);
		setSelectedAssetUrl(asset.url);
		setAssetManagerOpen(false);
	};

	const handleRemoveAsset = () => {
		setSelectedAssetId(undefined);
		setSelectedAssetUrl(undefined);
	};

	const handlePageLink = (page: Page) => {
		setLinkedPage(page._id);
		setLinkedPageTitle(page.title);
		setName(page.title); // Update name field with page title
		setPagePickerOpen(false);
	};

	const handlePageUnlink = () => {
		setLinkedPage(undefined);
		setLinkedPageTitle('');
		setName(''); // Clear name field when unlinking
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
				{mode === 'create' ? 'Create City' : 'Edit City'}
			</h2>

			{/* Page linking section */}
			<fieldset
				style={{ border: 'none', padding: 0, margin: '0 0 1rem 0' }}
			>
				<div
					style={{
						display: 'flex',
						gap: '0.5rem',
						alignItems: 'center',
						flexWrap: 'wrap',
					}}
				>
					{linkedPage ? (
						<>
							<span className="linkedToPage">
								Linked to: {linkedPageTitle || 'Loading...'}
							</span>
							{mode === 'create' && (
								<button
									type="button"
									className="btn-muted"
									onClick={handlePageUnlink}
									style={{
										padding: '0.25rem 0.75rem',
										fontSize: '0.85rem',
										marginTop: '0',
									}}
								>
									Unlink
								</button>
							)}
						</>
					) : (
						mode === 'create' ? (
							<button
								type="button"
								className="btn-primary"
								onClick={() => setPagePickerOpen(true)}
								style={{
									padding: '0.25rem 0.75rem',
									fontSize: '0.85rem',
									marginTop: '0',
									display: 'flex',
									flexDirection: 'row',
									alignItems: 'center',
								}}
							>
								<i className="icon icli iconly-Calendar" /> Link
								Page
							</button>
						) : null
					)}
				</div>
				{linkedPage && mode === 'create' && (
					<p
						style={{
							fontSize: '0.85rem',
							color: '#94a3b8',
							marginTop: '0.25rem',
						}}
					>
						City will use the page's title and data.
					</p>
				)}
			</fieldset>

			<div className="form-group">
				<label htmlFor="city-name">
					City Name {!linkedPage && '*'}
				</label>
				<input
					id="city-name"
					className={linkedPage ? 'linkedToPage' : ''}
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder={
						linkedPage
							? 'Using linked page title'
							: 'Enter city name'
					}
					autoFocus={!linkedPage}
					disabled={!!linkedPage}
					style={
						linkedPage
							? {
									opacity: 0.7,
									cursor: 'not-allowed',
							  }
							: {}
					}
				/>
			</div>

			<div className="form-group">
				<label>Icon Asset (optional)</label>
				<div className="asset-selector">
					{selectedAssetId && selectedAssetUrl ? (
						<div className="selected-asset">
							<img
								src={Api.resolveAssetUrl(selectedAssetUrl)}
								alt="City icon"
								className="asset-preview"
							/>
							<button
								type="button"
								className="remove-asset-btn"
								onClick={handleRemoveAsset}
							>
								Remove
							</button>
						</div>
					) : (
						<button
							type="button"
							className="select-asset-btn"
							onClick={() => setAssetManagerOpen(true)}
						>
							Select Icon
						</button>
					)}
				</div>
			</div>

			{/* Only show color/border/preview fields if NO asset icon is selected */}
			{!selectedAssetId && (
				<>
					<div className="form-group-cols">
						<div className="form-group form-group--half">
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

						<div className="form-group form-group--half">
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
					</div>
				</>
			)}

			<div className="modal-actions">
				{mode === 'edit' && onDelete && (
					<button className="btn-delete" onClick={onDelete}>
						Delete City
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

	// Click-outside only in tooltip mode AND when no child modal is open
	useEffect(() => {
		// If anchored tooltip isn't open, or a child modal is open, don't close on outside clicks
		if (!anchor || !isOpen || assetManagerOpen || pagePickerOpen) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (!panelRef.current) return;
			const target = e.target as Node;
			// If the click is inside the city panel, ignore
			if (panelRef.current.contains(target)) return;
			// If the click is inside a React-Modal overlay/content, ignore (child modals)
			const el = target as HTMLElement;
			if (el.closest('.modal__overlay') || el.closest('.modal__content'))
				return;
			onCancel();
		};
		document.addEventListener('mousedown', handleClickOutside, true);
		return () =>
			document.removeEventListener('mousedown', handleClickOutside, true);
	}, [anchor, isOpen, assetManagerOpen, pagePickerOpen, onCancel]);

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
			const panelW = panelRect?.width ?? 420;
			const panelH = panelRect?.height ?? 600; // More realistic height for city modal with all fields
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const margin = 16; // Increased margin for better spacing
			let left = anchor.x + offset;
			let top = anchor.y + offset;

			// Check if modal would overflow right edge
			if (left + panelW + margin > vw) {
				// Position to the left of cursor instead
				left = anchor.x - panelW - offset;
			}

			// Check if modal would overflow bottom edge
			if (top + panelH + margin > vh) {
				// Position above cursor instead, or at top of viewport if still too tall
				const topPosition = anchor.y - panelH - offset;
				top = Math.max(margin, topPosition);
			}

			// Ensure not negative or too far right
			left = Math.max(margin, Math.min(left, vw - panelW - margin));
			top = Math.max(margin, Math.min(top, vh - panelH - margin));

			setTooltipPos({ top, left });
		});
		return () => cancelAnimationFrame(raf);
	}, [anchor, isOpen, name, border, fill, selectedAssetId]);

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
				<AssetsManagerModal
					isOpen={assetManagerOpen}
					onClose={() => setAssetManagerOpen(false)}
					onSelect={handleAssetSelect}
				/>
				<PagePickerModal
					isOpen={pagePickerOpen}
					onClose={() => setPagePickerOpen(false)}
					onSelect={handlePageLink}
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
			<AssetsManagerModal
				isOpen={assetManagerOpen}
				onClose={() => setAssetManagerOpen(false)}
				onSelect={handleAssetSelect}
			/>
			<PagePickerModal
				isOpen={pagePickerOpen}
				onClose={() => setPagePickerOpen(false)}
				onSelect={handlePageLink}
				placeholder="Search place pages..."
				filterType="place"
			/>
		</>,
		modalRoot
	);
};

export default CityModal;
