import React, { useState, useRef } from 'react';
import { Page } from '../types';
import { useAppStore } from '../store/appStore';
import InteractiveMapCanvas, { PlacePage } from './InteractiveMapCanvas';
import RegionModal from './RegionModal';
import CityModal from './CityModal';
import PolygonEditModal from './PolygonEditModal';
import ConfirmModal from './ConfirmModal';
import { toast } from 'react-hot-toast';

interface PlaceMapViewProps {
	imageUrl: string;
	onPlaceClick: (place: PlacePage) => void;
	leftMenuCollapsed: boolean;
}

const PlaceMapView: React.FC<PlaceMapViewProps> = ({ 
	imageUrl, 
	onPlaceClick,
	leftMenuCollapsed,
}) => {
	// Store actions
	const pagesFromStore = useAppStore((s) => s.data.pages.data);
	const createPage = useAppStore((s) => s.createPage);
	const updatePage = useAppStore((s) => s.updatePage);
	const deletePage = useAppStore((s) => s.deletePage);
	const loadPages = useAppStore((s) => s.loadPages);
	const isDM = useAppStore((s) => s.isDM());

	// Sidebar state
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [sidebarPage, setSidebarPage] = useState<PlacePage | null>(null);
	const SIDEBAR_WIDTH = 400;
	
	// Left menu dimensions (controlled by parent)
	const LEFT_MENU_COLLAPSED_WIDTH = 0;
	const LEFT_MENU_FULL_WIDTH = 300;
	
	// Region selection
	const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

	// Map mode state
	const [mapMode, setMapMode] = useState<'view' | 'edit'>('view');

	// Region modal state
	const [regionModalOpen, setRegionModalOpen] = useState(false);
	const [regionModalMode, setRegionModalMode] = useState<'create' | 'edit'>('create');
	const [regionModalAnchor, setRegionModalAnchor] = useState<{ x: number; y: number } | null>(null);
	const [pendingRegionPoints, setPendingRegionPoints] = useState<Array<{ x: number; y: number }>>([]);
	const [editingRegion, setEditingRegion] = useState<PlacePage | null>(null);
	const [tempRegionColors, setTempRegionColors] = useState({ borderColor: '#c9a96e', fillColor: 'rgba(201, 169, 110, 0.3)' });

	// City modal state
	const [cityModalOpen, setCityModalOpen] = useState(false);
	const [cityModalMode, setCityModalMode] = useState<'create' | 'edit'>('create');
	const [cityModalAnchor, setCityModalAnchor] = useState<{ x: number; y: number } | null>(null);
	const [pendingCityCoords, setPendingCityCoords] = useState<{ x: number; y: number } | null>(null);
	const [editingCity, setEditingCity] = useState<PlacePage | null>(null);

	// Polygon editing state
	const [isEditingPolygon, setIsEditingPolygon] = useState(false);
	const [tempPolygonPoints, setTempPolygonPoints] = useState<Array<{ x: number; y: number }>>([]);

	// Confirm modal state
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [confirmModalConfig, setConfirmModalConfig] = useState<{
		title: string;
		message: string;
		onConfirm: () => void;
	}>({
		title: '',
		message: '',
		onConfirm: () => {},
	});

	// Handle place click - opens sidebar and calls parent callback
	const handlePlaceClick = (place: PlacePage) => {
		// Open sidebar with place details
		setSidebarPage(place);
		setSidebarOpen(true);

		// Keep region selection when clicking a city; only change on region clicks
		if (place.placeType === 'region') {
			setSelectedRegionId(place._id);
		} else if (place.placeType === 'city') {
			// Keep the region logically selected to maintain reveal
			if (place.coordinates?.parentRegionId) {
				setSelectedRegionId(place.coordinates.parentRegionId);
			}
		}
	};

	// Map click handler - creates a city
	const handleMapClick = (normalizedX: number, normalizedY: number, anchor?: { x: number; y: number }) => {
		setPendingCityCoords({ x: normalizedX, y: normalizedY });
		setCityModalMode('create');
		setEditingCity(null);
		setCityModalAnchor(anchor || null);
		setCityModalOpen(true);
	};

	// Polygon complete handler - creates a region
	const handlePolygonComplete = (
		points: Array<{ x: number; y: number }>,
		anchor?: { x: number; y: number }
	) => {
		console.log('Region polygon completed:', points);

		// Helper: Check if a point is inside a polygon using ray casting
		const isPointInPolygon = (
			x: number,
			y: number,
			polygon: Array<{ x: number; y: number }>
		) => {
			let inside = false;
			for (
				let i = 0, j = polygon.length - 1;
				i < polygon.length;
				j = i++
			) {
				const xi = polygon[i].x;
				const yi = polygon[i].y;
				const xj = polygon[j].x;
				const yj = polygon[j].y;
				const intersect =
					yi > y !== yj > y &&
					x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
				if (intersect) inside = !inside;
			}
			return inside;
		};

		// Check only for full containment: block if the NEW region is entirely inside an existing one
		const existingRegions = pagesFromStore.filter(
			(p) =>
				p.type === 'place' &&
				p.placeType === 'region' &&
				p.coordinates?.type === 'polygon'
		) as PlacePage[];

		for (const region of existingRegions) {
			const regionPoints = region.coordinates?.data.points;
			if (!regionPoints || regionPoints.length === 0) continue;

			// Case 1: NEW region fully inside existing region
			const newFullyInsideExisting = points.length > 0 && points.every((pt) =>
				isPointInPolygon(pt.x, pt.y, regionPoints)
			);

			if (newFullyInsideExisting) {
				toast.error('Cannot create a region entirely inside another region.');
				return;
			}

			// Case 2: Existing region fully inside NEW region
			const existingFullyInsideNew = regionPoints.every((pt) =>
				isPointInPolygon(pt.x, pt.y, points)
			);

			if (existingFullyInsideNew) {
				toast.error('Cannot create a region that fully contains an existing region.');
				return;
			}
		}

		setPendingRegionPoints(points);
		setRegionModalMode('create');
		setEditingRegion(null);
		setTempRegionColors({
			borderColor: '#c9a96e',
			fillColor: 'rgba(201, 169, 110, 0.3)',
		});
		setRegionModalAnchor(anchor || null);
		setRegionModalOpen(true);
	};

	// Region double-click handler - edits a region
	const handleRegionDoubleClick = (place: PlacePage, anchorClient?: { x: number; y: number }) => {
		setEditingRegion(place);
		setRegionModalMode('edit');
		setRegionModalAnchor(anchorClient || null);
		setRegionModalOpen(true);
	};

	// City double-click handler - edits a city
	const handleCityDoubleClick = (place: PlacePage, anchorClient?: { x: number; y: number }) => {
		setEditingCity(place);
		setCityModalMode('edit');
		setCityModalAnchor(anchorClient || null);
		setCityModalOpen(true);
	};

	// Region save handler
	const handleRegionSave = async (
		name: string,
		borderColor: string,
		fillColor: string,
		linkedPageId?: string
	) => {
		try {
			if (regionModalMode === 'create' && pendingRegionPoints.length > 0) {
				if (linkedPageId) {
					// Update existing page with region coordinates
					const existingPage = pagesFromStore.find(
						(p) => p._id === linkedPageId
					);
					if (existingPage) {
						const updatedPage: Partial<Page> = {
							...existingPage,
							title: name || existingPage.title,
							placeType: 'region',
							coordinates: {
								type: 'polygon',
								data: {
									points: pendingRegionPoints,
								},
								borderColor,
								fillColor,
							},
						};
						await updatePage(updatedPage);
						toast.success(
							`Region linked to page "${existingPage.title}" successfully`
						);
					}
				} else {
					// Create new region
					const newPage: Partial<Page> = {
						title: name,
						type: 'place',
						placeType: 'region',
						coordinates: {
							type: 'polygon',
							data: {
								points: pendingRegionPoints,
							},
							borderColor,
							fillColor,
						},
						blocks: [],
					};
					await createPage(newPage as Page);
					toast.success(`Region "${name}" created successfully`);
				}
			} else if (editingRegion) {
				// Update existing region
				const updatedPage: Partial<Page> = {
					...editingRegion,
					title: name || editingRegion.title,
					coordinates: {
						...editingRegion.coordinates!,
						data: {
							...editingRegion.coordinates!.data,
							// Use temp polygon points if they exist (from polygon editing)
							points: tempPolygonPoints.length > 0 ? tempPolygonPoints : editingRegion.coordinates!.data.points
						},
						borderColor,
						fillColor,
					},
				};
				await updatePage(updatedPage);
				toast.success(
					`Region "${
						name || editingRegion.title
					}" updated successfully`
				);
			}

			// Close modal and refresh
			setRegionModalOpen(false);
			setPendingRegionPoints([]);
			setEditingRegion(null);
			setTempPolygonPoints([]); // Clear temp polygon points
			setRegionModalAnchor(null);
			loadPages('place');
		} catch (error) {
			console.error('Failed to save region:', error);
			toast.error('Failed to save region');
		}
	};

	// City save handler
	const handleCitySave = async (
		name: string,
		borderColor: string,
		fillColor: string,
		assetId?: string,
		linkedPageId?: string
	) => {
		try {
			if (cityModalMode === 'create' && pendingCityCoords) {
				if (linkedPageId) {
					// Update existing page with coordinates
					const existingPage = pagesFromStore.find(
						(p) => p._id === linkedPageId
					);
					if (existingPage) {
						const updatedPage: Partial<Page> = {
							...existingPage,
							title: name || existingPage.title,
							placeType: 'city',
							coordinates: {
								type: 'point',
								data: {
									x: pendingCityCoords.x,
									y: pendingCityCoords.y,
								},
								borderColor,
								fillColor,
							},
							assetId,
						};
						await updatePage(updatedPage);
						toast.success(
							`City linked to page "${existingPage.title}" successfully`
						);
					}
				} else {
					// Create new city
					const newPage: Partial<Page> = {
						title: name,
						type: 'place',
						placeType: 'city',
						coordinates: {
							type: 'point',
							data: {
								x: pendingCityCoords.x,
								y: pendingCityCoords.y,
							},
							borderColor,
							fillColor,
						},
						assetId,
						blocks: [],
					};
					await createPage(newPage as Page);
					toast.success(`City "${name}" created successfully`);
				}
			} else if (editingCity) {
				// Update existing city
				// Remove assetId from spread if we're updating it
				const { assetId: _, ...cityWithoutAssetId } = editingCity;
				
				const updatedPage: Partial<Page> = {
					...cityWithoutAssetId,
					title: name || editingCity.title,
					coordinates: {
						...editingCity.coordinates!,
						borderColor,
						fillColor,
					},
					// Use null instead of undefined so it's included in JSON payload
					assetId: assetId || null,
				};
				
				await updatePage(updatedPage);
				toast.success(
					`City "${name || editingCity.title}" updated successfully`
				);
			}

			// Close modal and refresh
			setCityModalOpen(false);
			setPendingCityCoords(null);
			setEditingCity(null);
			setCityModalAnchor(null);
			loadPages('place');
		} catch (error) {
			console.error('Failed to save city:', error);
			toast.error('Failed to save city');
		}
	};

	// City drag handler
	const handleCityDrag = async (place: PlacePage, normalizedX: number, normalizedY: number) => {
		try {
			const updatedPage: Partial<Page> = {
				...place,
				coordinates: {
					...place.coordinates!,
					data: {
						...place.coordinates!.data,
						x: normalizedX,
						y: normalizedY,
					},
				},
			};
			await updatePage(updatedPage);
			loadPages('place');
		} catch (error) {
			console.error('Failed to update city position:', error);
			toast.error('Failed to move city');
		}
	};

	// Region polygon update handler (during editing)
	const handleRegionPolygonUpdate = (place: PlacePage, newPoints: Array<{ x: number; y: number }>) => {
		setTempPolygonPoints(newPoints);
	};

	// Polygon editing handlers
	const handleStartPolygonEdit = () => {
		if (!editingRegion?.coordinates?.data.points) return;
		
		// Save current points to temp
		setTempPolygonPoints([...editingRegion.coordinates.data.points]);
		
		// Enter polygon editing mode
		setIsEditingPolygon(true);
		
		// Hide region modal
		setRegionModalOpen(false);
	};

	const handleSavePolygonEdit = async () => {
		if (!editingRegion) return;

		try {
			const updatedPage: Partial<Page> = {
				...editingRegion,
				coordinates: {
					...editingRegion.coordinates!,
					data: {
						...editingRegion.coordinates!.data,
						points: tempPolygonPoints,
					},
				},
			};
			await updatePage(updatedPage);
			toast.success('Polygon updated successfully');
			
			// Update editingRegion with new points
			setEditingRegion({
				...editingRegion,
				coordinates: {
					...editingRegion.coordinates!,
					data: {
						...editingRegion.coordinates!.data,
						points: tempPolygonPoints,
					},
				},
			} as PlacePage);
			
			// Clear temp polygon points since we've saved them
			setTempPolygonPoints([]);
			
			// Reload to reflect changes
			loadPages('place');
			
			// Exit polygon editing mode and reopen region modal
			setIsEditingPolygon(false);
			setRegionModalOpen(true);
		} catch (error) {
			console.error('Failed to update polygon:', error);
			toast.error('Failed to update region shape');
		}
	};

	const handleCancelPolygonEdit = () => {
		setTempPolygonPoints([]);
		setIsEditingPolygon(false);
		setRegionModalOpen(true);
	};

	// Region delete handler
	const handleRegionDelete = () => {
		if (!editingRegion) return;

		// Check if there are cities inside this region
		const citiesInRegion = pagesFromStore.filter((p) => {
			if (p.type !== 'place' || p.placeType !== 'city') return false;
			if (!p.coordinates || p.coordinates.type !== 'point') return false;
			
			// Check if city is inside the region
			const cityX = p.coordinates.data.x!;
			const cityY = p.coordinates.data.y!;
			const regionPoints = editingRegion.coordinates?.data.points;
			
			if (!regionPoints) return false;
			
			// Point-in-polygon check
			let inside = false;
			for (let i = 0, j = regionPoints.length - 1; i < regionPoints.length; j = i++) {
				const xi = regionPoints[i].x;
				const yi = regionPoints[i].y;
				const xj = regionPoints[j].x;
				const yj = regionPoints[j].y;
				const intersect = yi > cityY !== yj > cityY && cityX < ((xj - xi) * (cityY - yi)) / (yj - yi) + xi;
				if (intersect) inside = !inside;
			}
			return inside;
		});

		if (citiesInRegion.length > 0) {
			toast.error(`Cannot delete region: it contains ${citiesInRegion.length} ${citiesInRegion.length === 1 ? 'city' : 'cities'}`);
			return;
		}

		setConfirmModalConfig({
			title: 'Delete Region',
			message: `Are you sure you want to delete the region "${editingRegion.title}"?`,
			onConfirm: async () => {
				try {
					await deletePage(editingRegion._id!);
					toast.success('Region deleted successfully');
					setRegionModalOpen(false);
					setEditingRegion(null);
					setConfirmModalOpen(false);
					loadPages('place');
				} catch (error) {
					console.error('Failed to delete region:', error);
					toast.error('Failed to delete region');
					setConfirmModalOpen(false);
				}
			},
		});
		setConfirmModalOpen(true);
	};

	// City delete handler
	const handleCityDelete = () => {
		if (!editingCity) return;

		setConfirmModalConfig({
			title: 'Delete City',
			message: `Are you sure you want to delete the city "${editingCity.title}"?`,
			onConfirm: async () => {
				try {
					await deletePage(editingCity._id!);
					toast.success('City deleted successfully');
					setCityModalOpen(false);
					setEditingCity(null);
					setConfirmModalOpen(false);
					loadPages('place');
				} catch (error) {
					console.error('Failed to delete city:', error);
					toast.error('Failed to delete city');
					setConfirmModalOpen(false);
				}
			},
		});
		setConfirmModalOpen(true);
	};

	const handleRegionCancel = () => {
		setRegionModalOpen(false);
		setPendingRegionPoints([]);
		setEditingRegion(null);
		setRegionModalAnchor(null);
	};

	const handleCityOutsideRegion = () => {
		toast.error('Cities can only be created inside existing regions!');
	};

	const handleRegionOverlap = () => {
		toast.error('Regions cannot overlap with existing regions!');
	};

	return (
		<div className="mapBackgroundLayer">
			<InteractiveMapCanvas
				imageUrl={imageUrl}
				places={
					(pagesFromStore.filter(
						(p) => p.type === 'place'
					) as PlacePage[]).map(place => {
						// If this is the region being edited and we have temp points, use them
						if (isEditingPolygon && place._id === editingRegion?._id && tempPolygonPoints.length > 0) {
							return {
								...place,
								coordinates: {
									...place.coordinates!,
									data: {
										...place.coordinates!.data,
										points: tempPolygonPoints
									}
								}
							} as PlacePage;
						}
						return place;
					})
				}
				mode={mapMode}
				minZoom={0.5}
				maxZoom={3}
				sidebarWidth={sidebarOpen ? SIDEBAR_WIDTH : 0}
				leftMenuWidth={
					leftMenuCollapsed
						? LEFT_MENU_COLLAPSED_WIDTH
						: LEFT_MENU_FULL_WIDTH
				}
				selectedRegionId={selectedRegionId}
				editingRegionId={editingRegion?._id || null}
				isEditingPolygon={isEditingPolygon}
				onPlaceClick={handlePlaceClick}
				onPlaceDoubleClick={handleRegionDoubleClick}
				onCityDoubleClick={handleCityDoubleClick}
				onCityDrag={handleCityDrag}
				onRegionPolygonUpdate={handleRegionPolygonUpdate}
				onMapClick={handleMapClick}
				onPolygonComplete={handlePolygonComplete}
				onCityOutsideRegion={handleCityOutsideRegion}
				onRegionOverlap={handleRegionOverlap}
				tempRegion={
					regionModalOpen && !isEditingPolygon
						? {
								points: pendingRegionPoints,
								borderColor:
									tempRegionColors.borderColor,
								fillColor: tempRegionColors.fillColor,
						  }
						: undefined
				}
			/>

			{/* Polygon Edit Modal */}
			<PolygonEditModal
				isOpen={isEditingPolygon}
				regionName={editingRegion?.title || ''}
				onSave={handleSavePolygonEdit}
				onCancel={handleCancelPolygonEdit}
			/>

			{/* Region Modal */}
			<RegionModal
				isOpen={regionModalOpen}
				mode={regionModalMode}
				regionName={editingRegion?.title || ''}
				borderColor={editingRegion?.coordinates?.borderColor || '#c9a96e'}
				fillColor={editingRegion?.coordinates?.fillColor || 'rgba(201, 169, 110, 0.3)'}
				anchor={regionModalAnchor ?? undefined}
				onSave={handleRegionSave}
				onCancel={handleRegionCancel}
				onDelete={regionModalMode === 'edit' ? handleRegionDelete : undefined}
				onEditPolygon={regionModalMode === 'edit' ? handleStartPolygonEdit : undefined}
			/>

			{/* City Modal */}
			<CityModal
				isOpen={cityModalOpen}
				mode={cityModalMode}
				cityName={editingCity?.title || ''}
				borderColor={editingCity?.coordinates?.borderColor || '#ffffff'}
				fillColor={editingCity?.coordinates?.fillColor || 'rgba(201, 169, 110, 0.3)'}
				assetId={editingCity?.assetId}
				anchor={cityModalAnchor ?? undefined}
				onSave={handleCitySave}
				onCancel={() => {
					setCityModalOpen(false);
					setPendingCityCoords(null);
					setEditingCity(null);
					setCityModalAnchor(null);
				}}
				onDelete={cityModalMode === 'edit' ? handleCityDelete : undefined}
			/>

			{/* Confirm Modal */}
			<ConfirmModal
				isOpen={confirmModalOpen}
				title={confirmModalConfig.title}
				message={confirmModalConfig.message}
				onConfirm={confirmModalConfig.onConfirm}
				onCancel={() => setConfirmModalOpen(false)}
			/>

			{/* Right Sidebar for Place Details */}
			{sidebarOpen && sidebarPage && (
				<div className="sidebarPageDetail">
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							marginBottom: '1.5rem',
						}}
					>
						<h2
							style={{
								margin: 0,
								fontSize: '1.5rem',
								color: '#e6c896',
							}}
						>
							{sidebarPage.title}
						</h2>
						<button
							onClick={() => {
								setSidebarOpen(false);
								setSelectedRegionId(null);
							}}
							style={{
								background: 'none',
								border: 'none',
								color: '#94a3b8',
								cursor: 'pointer',
								fontSize: '1.5rem',
								padding: '0.25rem',
							}}
						>
							×
						</button>
					</div>

					<div style={{ marginBottom: '1rem' }}>
						<div
							style={{
								fontSize: '0.875rem',
								color: '#94a3b8',
								marginBottom: '0.5rem',
							}}
						>
							Type:{' '}
							<span style={{ color: '#e6c896' }}>
								{sidebarPage.placeType || 'place'}
							</span>
						</div>
					</div>

					<div style={{ marginTop: '1.5rem' }}>
						<button
							onClick={() => {
								onPlaceClick(sidebarPage as PlacePage);
							}}
							style={{
								width: '100%',
								padding: '0.75rem 1rem',
								backgroundColor: '#3b82f6',
								color: 'white',
								border: 'none',
								borderRadius: '0.375rem',
								cursor: 'pointer',
								fontSize: '0.875rem',
								fontWeight: '500',
							}}
						>
							Open Full Details
						</button>
					</div>

					{sidebarPage.blocks &&
						sidebarPage.blocks.length > 0 && (
							<div style={{ marginTop: '1.5rem' }}>
								<h3
									style={{
										fontSize: '1rem',
										marginBottom: '0.75rem',
										color: '#cbd5e1',
									}}
								>
									Description
								</h3>
								<div
									style={{
										fontSize: '0.875rem',
										lineHeight: '1.6',
										color: '#94a3b8',
									}}
								>
									{sidebarPage.blocks[0]?.plainText?.substring(
										0,
										200
									)}
									{sidebarPage.blocks[0]?.plainText &&
										sidebarPage.blocks[0].plainText
											.length > 200 &&
										'...'}
								</div>
							</div>
						)}
				</div>
			)}

			{/* Map Mode Toggle */}
			{isDM && (
				<div style={{
					position: 'absolute',
					bottom: '20px',
					right: '20px',
					zIndex: 100,
				}}>
					<button
						onClick={() => setMapMode(mapMode === 'view' ? 'edit' : 'view')}
						style={{
							padding: '12px 24px',
							backgroundColor: mapMode === 'edit' ? '#4a90e2' : '#c9a96e',
							color: 'white',
							border: 'none',
							borderRadius: '8px',
							cursor: 'pointer',
							fontWeight: 'bold',
							fontSize: '14px',
							boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
							transition: 'all 0.3s ease',
						}}
					>
						{mapMode === 'view' ? '✏️ Edit Mode' : '👁️ View Mode'}
					</button>
				</div>
			)}
		</div>
	);
};

export default PlaceMapView;
