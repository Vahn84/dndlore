import React, { useRef, useEffect, useState } from 'react';
import {
	Stage,
	Layer,
	Image as KonvaImage,
	Circle,
	Line,
	Group,
	Text,
	Rect,
} from 'react-konva';
import useImage from 'use-image';
import { Page } from '../types';
import '../styles/InteractiveMapCanvas.scss';
import Api from '../Api';
import { useAppStore } from '../store/appStore';

export interface MapCoordinates {
	type: 'point' | 'polygon';
	data: {
		x?: number; // normalized 0-1
		y?: number; // normalized 0-1
		points?: Array<{ x: number; y: number }>; // normalized 0-1
	};
	parentRegionId?: string;
	borderColor?: string; // border color for regions
	fillColor?: string; // fill color for regions (with opacity)
}

export interface PlacePage extends Page {
	type: 'place';
	placeType?: 'region' | 'city';
	coordinates?: MapCoordinates;
    borderColor?: string;   
    fillColor?: string;
    fillOpacity?: number;
	assetId?: string;
}

interface InteractiveMapCanvasProps {
	imageUrl: string;
	places: PlacePage[];
	minZoom?: number;
	maxZoom?: number;
	mode: 'view' | 'edit';
	sidebarWidth?: number; // Width of right sidebar to account for in zoom/center calculations
	leftMenuWidth?: number; // Width of left menu to account for in zoom/center calculations
	selectedRegionId?: string | null; // ID of selected region to filter cities
	editingRegionId?: string | null; // ID of region whose polygon is being edited
	isEditingPolygon?: boolean; // Whether we're in dedicated polygon editing mode
	onPlaceClick?: (place: PlacePage) => void;
	onPlaceDoubleClick?: (
		place: PlacePage,
		anchorClient?: { x: number; y: number }
	) => void;
	onCityDoubleClick?: (place: PlacePage, anchorClient?: { x: number; y: number }) => void;
	onCityDrag?: (place: PlacePage, normalizedX: number, normalizedY: number) => void;
	onRegionPolygonUpdate?: (place: PlacePage, newPoints: Array<{ x: number; y: number }>) => void;
	onMapClick?: (normalizedX: number, normalizedY: number, anchor?: { x: number; y: number }) => void;
	onPolygonComplete?: (
		points: Array<{ x: number; y: number }>,
		anchorClient?: { x: number; y: number }
	) => void;
	onPolygonPointsChange?: (points: Array<{ x: number; y: number }>) => void;
	onCityOutsideRegion?: () => void;
	onRegionOverlap?: () => void;
	tempRegion?: {
		points: Array<{ x: number; y: number }>;
		borderColor: string;
		fillColor: string;
	};
}

const InteractiveMapCanvas: React.FC<InteractiveMapCanvasProps> = ({
	imageUrl,
	places,
	minZoom = 0.5,
	maxZoom = 3,
	mode = 'view',
	sidebarWidth = 0,
	leftMenuWidth = 0,
	selectedRegionId = null,
	editingRegionId = null,
	isEditingPolygon = false,
	onPlaceClick,
	onPlaceDoubleClick,
	onCityDoubleClick,
	onCityDrag,
	onRegionPolygonUpdate,
	onMapClick,
	onPolygonComplete,
	onPolygonPointsChange,
	onCityOutsideRegion,
	onRegionOverlap,
	tempRegion,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
	const [image] = useImage(imageUrl);
	const [stageConfig, setStageConfig] = useState({
		x: 0,
		y: 0,
		scale: 1,
	});
	const [polygonPoints, setPolygonPoints] = useState<
		Array<{ x: number; y: number }>
	>([]);
	const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const dragStartPos = useRef<{ x: number; y: number } | null>(null);
	const [hoveredPlace, setHoveredPlace] = useState<string | null>(null);
	const [currentMousePos, setCurrentMousePos] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [isPanning, setIsPanning] = useState(false);
	const panStartPos = useRef<{ x: number; y: number } | null>(null);
	const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const lastClickedRegion = useRef<PlacePage | null>(null); // Track region to re-zoom when sidebar opens
	const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null); // Index of polygon point being dragged
	const [featherAnimation, setFeatherAnimation] = useState(0); // Animation value for feather effect (0-1)
	const SNAP_DISTANCE = 0.02; // Distance threshold to snap to first point (in normalized coords)
	const CLICK_DELAY = 200; // Delay in ms to detect double-click
	// Update dimensions on mount and window resize
	useEffect(() => {
		const updateDimensions = () => {
			if (containerRef.current) {
				setDimensions({
					width: containerRef.current.offsetWidth,
					height: containerRef.current.offsetHeight,
				});
			}
		};

		updateDimensions();
		window.addEventListener('resize', updateDimensions);
		return () => window.removeEventListener('resize', updateDimensions);
	}, []);

	// Center image when it loads - start at minZoom
	useEffect(() => {
		if (image && dimensions.width && dimensions.height) {
			// Start at minZoom (0.5) centered
			const scale = minZoom;
			setStageConfig({
				x: (dimensions.width - image.width * scale) / 2,
				y: (dimensions.height - image.height * scale) / 2,
				scale,
			});
		}
	}, [image, dimensions, minZoom]);

	// Reset polygon when switching modes
	useEffect(() => {
		if (mode === 'view') {
			setPolygonPoints([]);
			setIsDrawingPolygon(false);
		}
		// Clear any pending click timeout when mode changes
		if (clickTimeoutRef.current) {
			clearTimeout(clickTimeoutRef.current);
			clickTimeoutRef.current = null;
		}
	}, [mode]);

	// Re-zoom to selected region when sidebar width changes (sidebar opening/closing)
	useEffect(() => {
		if (lastClickedRegion.current && sidebarWidth > 0) {
			// Sidebar just opened, re-zoom with correct dimensions
			zoomToRegion(lastClickedRegion.current);
		}
	}, [sidebarWidth]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (clickTimeoutRef.current) {
				clearTimeout(clickTimeoutRef.current);
			}
		};
	}, []);

	// Animate feather effect continuously
	useEffect(() => {
		let animationFrame: number;
		let startTime = Date.now();
		
		const animate = () => {
			const elapsed = Date.now() - startTime;
			// Create a pulsing effect: 0 -> 1 -> 0 over 2 seconds
			const cycle = (elapsed % 2000) / 2000; // 0 to 1 over 2 seconds
			const pulse = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2; // Triangle wave: up then down
			setFeatherAnimation(pulse);
			animationFrame = requestAnimationFrame(animate);
		};
		
		animate();
		
		return () => {
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}
		};
	}, []);

	const handleWheel = (e: any) => {
		e.evt.preventDefault();

		const stage = e.target.getStage();
		const oldScale = stage.scaleX();
		const pointer = stage.getPointerPosition();

		const mousePointTo = {
			x: (pointer.x - stage.x()) / oldScale,
			y: (pointer.y - stage.y()) / oldScale,
		};

		const newScale = Math.max(
			minZoom,
			Math.min(maxZoom, oldScale - e.evt.deltaY * 0.001)
		);

		setStageConfig({
			scale: newScale,
			x: pointer.x - mousePointTo.x * newScale,
			y: pointer.y - mousePointTo.y * newScale,
		});
	};

	const handleDragEnd = (e: any) => {
		setStageConfig({
			...stageConfig,
			x: e.target.x(),
			y: e.target.y(),
		});
	};

	const handleStageMouseDown = (e: any) => {
		if (!image) return;

		// Right-click panning in both edit and view modes
		if (e.evt.button === 2) {
			e.cancelBubble = true;
			const stage = e.target.getStage();
			const pointerPos = stage.getPointerPosition();
			panStartPos.current = {
				x: pointerPos.x - stageConfig.x,
				y: pointerPos.y - stageConfig.y,
			};
			setIsPanning(true);
			return;
		}

		// Disable polygon drawing during polygon edit mode
		if (isEditingPolygon) return;

		if (mode !== 'edit') return;

		// Prevent Stage from handling drag in edit mode
		e.cancelBubble = true;

		const stage = e.target.getStage();
		const pointerPos = stage.getPointerPosition();

		// Convert to normalized coordinates
		const imageX = (pointerPos.x - stageConfig.x) / stageConfig.scale;
		const imageY = (pointerPos.y - stageConfig.y) / stageConfig.scale;
		const normalizedX = imageX / image.width;
		const normalizedY = imageY / image.height;

		// Check bounds
		if (
			normalizedX < 0 ||
			normalizedX > 1 ||
			normalizedY < 0 ||
			normalizedY > 1
		) {
			return;
		}

		dragStartPos.current = { x: normalizedX, y: normalizedY };
		setIsDragging(false);
		setCurrentMousePos({ x: normalizedX, y: normalizedY });
	};

	const handleStageMouseMove = (e: any) => {
		if (!image) return;

		const stage = e.target.getStage();
		const pointerPos = stage.getPointerPosition();

		// Right-click panning in both edit and view modes
		if (isPanning && panStartPos.current) {
			e.cancelBubble = true;
			setStageConfig({
				...stageConfig,
				x: pointerPos.x - panStartPos.current.x,
				y: pointerPos.y - panStartPos.current.y,
			});
			return;
		}

		if (mode !== 'edit') return;

		// Convert to normalized coordinates
		const imageX = (pointerPos.x - stageConfig.x) / stageConfig.scale;
		const imageY = (pointerPos.y - stageConfig.y) / stageConfig.scale;
		const normalizedX = imageX / image.width;
		const normalizedY = imageY / image.height;

		// Only update mouse position for drawing preview if we're actively drawing or have started a drag
		if (dragStartPos.current || isDrawingPolygon) {
			setCurrentMousePos({ x: normalizedX, y: normalizedY });
		}

		if (!dragStartPos.current) return;

		// Prevent Stage from handling drag in edit mode
		e.cancelBubble = true;

		// Check if we've moved enough to be considered dragging
		const dx = normalizedX - dragStartPos.current.x;
		const dy = normalizedY - dragStartPos.current.y;
		const distance = Math.sqrt(dx * dx + dy * dy);

		if (distance > 0.01 && !isDragging) {
			// Small threshold in normalized coords
			// First time we start dragging - add the first point
			setIsDragging(true);
			setIsDrawingPolygon(true);
			const firstPoint = {
				x: dragStartPos.current.x,
				y: dragStartPos.current.y,
			};
			setPolygonPoints([firstPoint]);
			onPolygonPointsChange?.([firstPoint]);
		}
	};

	const handleStageMouseUp = (e: any) => {
		// Handle right-click panning release
		if (isPanning) {
			setIsPanning(false);
			panStartPos.current = null;
			return;
		}

		// Disable interactions during polygon edit mode
		if (isEditingPolygon) return;

		if (!image || mode !== 'edit' || !dragStartPos.current) return;

		// Prevent Stage from handling drag in edit mode
		e.cancelBubble = true;

		const stage = e.target.getStage();
		const pointerPos = stage.getPointerPosition();
		// Compute viewport anchor position for tooltip consumers
		let anchorClient: { x: number; y: number } | undefined = undefined;
		if (containerRef.current && pointerPos) {
			const rect = containerRef.current.getBoundingClientRect();
			anchorClient = { x: rect.left + pointerPos.x, y: rect.top + pointerPos.y };
		}

		// Convert screen coordinates to image coordinates
		const imageX = (pointerPos.x - stageConfig.x) / stageConfig.scale;
		const imageY = (pointerPos.y - stageConfig.y) / stageConfig.scale;

		// Normalize to 0-1 range
		const normalizedX = imageX / image.width;
		const normalizedY = imageY / image.height;

		// Check bounds
		if (
			normalizedX < 0 ||
			normalizedX > 1 ||
			normalizedY < 0 ||
			normalizedY > 1
		) {
			dragStartPos.current = null;
			setCurrentMousePos(null);
			return;
		}

		// If we're in polygon drawing mode
		if (isDrawingPolygon) {
			// Check if clicking on an existing polygon point to complete it
			if (polygonPoints.length >= 3) {
				for (const point of polygonPoints) {
					const dx = normalizedX - point.x;
					const dy = normalizedY - point.y;
					const distanceToPoint = Math.sqrt(dx * dx + dy * dy);

					if (distanceToPoint < SNAP_DISTANCE) {
						// Clicked on an existing point - complete the polygon
						onPolygonComplete?.(polygonPoints, anchorClient);
						setPolygonPoints([]);
						setIsDrawingPolygon(false);
						dragStartPos.current = null;
						setCurrentMousePos(null);
						setIsDragging(false);
						return;
					}
				}
			}

			// Not clicking on existing point - add new point to polygon
			const newPoints = [
				...polygonPoints,
				{ x: normalizedX, y: normalizedY },
			];
			setPolygonPoints(newPoints);
			onPolygonPointsChange?.(newPoints);
		} else if (!isDragging) {
			// Not in polygon mode and not dragging - delay single click to detect double-click
			const containingRegion = findContainingRegion(
				normalizedX,
				normalizedY
			);
			
			// Clear any existing timeout
			if (clickTimeoutRef.current) {
				clearTimeout(clickTimeoutRef.current);
				clickTimeoutRef.current = null;
			}
			
			// Set a timeout for single-click action
			clickTimeoutRef.current = setTimeout(() => {
				if (containingRegion) {
					// Clicking inside a region: start city creation
					onMapClick?.(normalizedX, normalizedY, anchorClient);
				} else {
					// Clicking outside any region: show error
					onCityOutsideRegion?.();
				}
				clickTimeoutRef.current = null;
			}, CLICK_DELAY);
		}

		dragStartPos.current = null;
		setCurrentMousePos(null);
		setIsDragging(false);
	};

	const handleStageClick = (e: any) => {
		// Click handling is now done in mouseUp
	};

	const handlePolygonComplete = () => {
		if (polygonPoints.length >= 3) {
			onPolygonComplete?.(polygonPoints);
			setPolygonPoints([]);
			setIsDrawingPolygon(false);
		}
	};

	// Check if a point is inside a polygon using ray casting algorithm
	const isPointInPolygon = (
		x: number,
		y: number,
		polygon: Array<{ x: number; y: number }>
	) => {
		let inside = false;
		for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
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

	// Find which region (if any) contains a point
	const findContainingRegion = (x: number, y: number): PlacePage | null => {
		const regions = places.filter(
			(p) => p.placeType === 'region' && p.coordinates?.type === 'polygon'
		);

		for (const region of regions) {
			if (region.coordinates?.data.points) {
				if (isPointInPolygon(x, y, region.coordinates.data.points)) {
					return region;
				}
			}
		}
		return null;
	};

	// Check if two polygons overlap using Separating Axis Theorem (SAT)
	const doPolygonsOverlap = (
		polyA: Array<{ x: number; y: number }>,
		polyB: Array<{ x: number; y: number }>
	): boolean => {
		// Check if any vertex of one polygon is inside the other
		for (const point of polyA) {
			if (isPointInPolygon(point.x, point.y, polyB)) return true;
		}
		for (const point of polyB) {
			if (isPointInPolygon(point.x, point.y, polyA)) return true;
		}
		// Check if any edges intersect
		for (let i = 0; i < polyA.length; i++) {
			const a1 = polyA[i];
			const a2 = polyA[(i + 1) % polyA.length];
			for (let j = 0; j < polyB.length; j++) {
				const b1 = polyB[j];
				const b2 = polyB[(j + 1) % polyB.length];
				if (doSegmentsIntersect(a1, a2, b1, b2)) return true;
			}
		}
		return false;
	};

	// Check if two line segments intersect
	const doSegmentsIntersect = (
		p1: { x: number; y: number },
		p2: { x: number; y: number },
		p3: { x: number; y: number },
		p4: { x: number; y: number }
	): boolean => {
		const ccw = (A: { x: number; y: number }, B: { x: number; y: number }, C: { x: number; y: number }) => {
			return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
		};
		return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
	};

	// Convert normalized coordinates to screen coordinates
	const toScreenCoords = (normalizedX: number, normalizedY: number) => {
		if (!image) return { x: 0, y: 0 };
		return {
			x: normalizedX * image.width,
			y: normalizedY * image.height,
		};
	};

	// Convert screen coordinates back to normalized coordinates
	const toNormalizedCoords = (screenX: number, screenY: number) => {
		if (!image) return { x: 0, y: 0 };
		return {
			x: screenX / image.width,
			y: screenY / image.height,
		};
	};

	// Calculate centroid of a polygon
	const calculateCentroid = (points: Array<{ x: number; y: number }>) => {
		let sumX = 0;
		let sumY = 0;
		for (const point of points) {
			sumX += point.x;
			sumY += point.y;
		}
		return {
			x: sumX / points.length,
			y: sumY / points.length,
		};
	};

	// Zoom and center on a region
	const zoomToRegion = (place: PlacePage) => {
		if (!image || !place.coordinates?.data.points) return;

		const points = place.coordinates.data.points;
		
		// Calculate bounding box in normalized coordinates
		let minX = 1, minY = 1, maxX = 0, maxY = 0;
		for (const point of points) {
			minX = Math.min(minX, point.x);
			minY = Math.min(minY, point.y);
			maxX = Math.max(maxX, point.x);
			maxY = Math.max(maxY, point.y);
		}

		// Convert to image coordinates
		const boxMinX = minX * image.width;
		const boxMinY = minY * image.height;
		const boxMaxX = maxX * image.width;
		const boxMaxY = maxY * image.height;
		const boxWidth = boxMaxX - boxMinX;
		const boxHeight = boxMaxY - boxMinY;
		const boxCenterX = (boxMinX + boxMaxX) / 2;
		const boxCenterY = (boxMinY + boxMaxY) / 2;

		// Account for only right sidebar width (left menu will be hidden/collapsed)
		const availableWidth = dimensions.width - sidebarWidth;
		const availableHeight = dimensions.height;

		// Calculate zoom level with padding
		const padding = 100; // pixels of padding around the region
		const scaleX = (availableWidth - padding * 2) / boxWidth;
		const scaleY = (availableHeight - padding * 2) / boxHeight;
		const targetScale = Math.min(scaleX, scaleY, maxZoom);
		const clampedScale = Math.max(minZoom, Math.min(maxZoom, targetScale));

		// Calculate center position accounting for sidebar on the right
		// The center of the available space (full width minus sidebar) in screen coordinates
		const viewportCenterX = availableWidth / 2;
		const viewportCenterY = availableHeight / 2;

		// Calculate stage position to center the region
		const newX = viewportCenterX - boxCenterX * clampedScale;
		const newY = viewportCenterY - boxCenterY * clampedScale;

		setStageConfig({
			x: newX,
			y: newY,
			scale: clampedScale,
		});
	};

	// Handle region click: zoom in view mode, navigate on subsequent clicks
	const handleRegionClick = (place: PlacePage, e: any) => {
		if (mode !== 'view') return;
		if (e.evt && e.evt.button !== 0) return; // Only left click

		// Store the clicked region so we can re-zoom when sidebar opens
		lastClickedRegion.current = place;
		
		// Zoom to region immediately
		zoomToRegion(place);

		// Trigger navigation callback (this will open sidebar and trigger re-zoom via useEffect)
		onPlaceClick?.(place);
	};

	return (
		<div
			ref={containerRef}
			style={{
				width: '100%',
				height: '100%',
				position: 'relative',
				overflow: 'hidden',
				backgroundColor: '#1a1a1a',
				cursor: mode === 'view' && hoveredPlace ? 'pointer' : 'default',
			}}
			className="interactive-map-container"
			onContextMenu={(e) => e.preventDefault()}
		>
			{dimensions.width > 0 && (
				<Stage
					width={dimensions.width}
					height={dimensions.height}
					scaleX={stageConfig.scale}
					scaleY={stageConfig.scale}
					x={stageConfig.x}
					y={stageConfig.y}
					draggable={false}
					onWheel={handleWheel}
					onDragEnd={handleDragEnd}
					onMouseDown={handleStageMouseDown}
					onMouseMove={handleStageMouseMove}
					onMouseUp={handleStageMouseUp}
				>
					<Layer>
						{/* Map Image */}
						{image && <KonvaImage image={image} />}
					</Layer>
					
					{/* Overlay layer with cutouts for revealed regions */}
					<Layer>
						{/* Dark overlay on entire map */}
						{image && (
							<Rect
								x={0}
								y={0}
								width={image.width}
								height={image.height}
								fill="rgba(0, 0, 0, 0.6)"
								listening={false}
							/>
						)}
						
						{/* Cut out darkness from hovered/selected regions using destination-out */}
						{image && places
							.filter(
								(p) =>
									p.placeType === 'region' &&
									p.coordinates?.type === 'polygon'
							)
							.map((place) => {
								const isHovered = hoveredPlace === place._id;
								const isSelected = selectedRegionId === place._id;
								const shouldReveal = isHovered || isSelected;
								
								if (!shouldReveal) return null;
								
								const points = place.coordinates!.data.points!;
								const flatPoints = points.flatMap((p) => {
									const screen = toScreenCoords(p.x, p.y);
									return [screen.x, screen.y];
								});
								
								// Pseudo-random function based on place ID for consistent fractal patterns
								const pseudoRandom = (seed: number) => {
									const x = Math.sin(seed + place._id.charCodeAt(0)) * 10000;
									return x - Math.floor(x);
								};
								
								// Create multiple layers with increasing size for fractal fog-like diffusion
								return (
									<React.Fragment key={`cutout-${place._id}`}>
										{/* Outer feather layers - create irregular fractal fog pattern */}
										{[180, 170, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 8, 6, 4, 2].map((offset, index, array) => {
											// Add fractal variation to offsets for irregular edges
											const fractalNoise = pseudoRandom(index * 7.3) * 12 - 6; // -6 to +6
											const animatedOffset = (offset + fractalNoise) * (0.95 + featherAnimation * 0.1);
											
											// Calculate opacity with exponential falloff - higher base opacity for denser fog
											const normalizedIndex = index / (array.length - 1); // 0 to 1
											const exponentialFactor = Math.pow(1 - normalizedIndex, 2.2); // Quadratic falloff
											const baseOpacity = 0.04 + exponentialFactor * 0.16; // Higher base opacity
											const animatedOpacity = baseOpacity * (1.5 + featherAnimation * 0.2);
											
											// Create irregular fractal dash patterns for wispy edges
											const isOuterLayer = index < 12; // More outer layers with dashes
											
											// Irregular dash patterns with fractal variation
											const dashBase = 4 + pseudoRandom(index * 5.1) * 18; // 4-22
											const gapBase = 3 + pseudoRandom(index * 8.9) * 14; // 3-17
											
											// Add variation that changes with depth
											const dashVariation = pseudoRandom(index * 13.3) * 8 * (1 - normalizedIndex); // More variation in outer layers
											const gapVariation = pseudoRandom(index * 17.7) * 10 * normalizedIndex; // More variation in inner layers
											
											const dashLength = dashBase + dashVariation;
											const gapLength = gapBase + gapVariation;
											const dashPattern = [dashLength / stageConfig.scale, gapLength / stageConfig.scale];
											
											// Use fractal dashes on outer layers for irregular edges
											const useFractalDash = isOuterLayer && pseudoRandom(index * 3.7) > 0.25;
											
											// Vary tension slightly for more organic edges
											const tension = 0.55 + pseudoRandom(index * 19.1) * 0.15; // 0.55-0.7
											
											return (
												<Line
													key={`feather-${place._id}-${index}`}
													points={flatPoints}
													closed
													stroke={`rgba(0, 0, 0, ${animatedOpacity})`}
													strokeWidth={animatedOffset / stageConfig.scale}
													listening={false}
													globalCompositeOperation="destination-out"
													tension={tension}
													lineCap="round"
													lineJoin="round"
													dash={useFractalDash ? dashPattern : undefined}
													dashOffset={useFractalDash ? (featherAnimation * 60 + index * 6 + pseudoRandom(index * 23.1) * 25) : 0}
												/>
											);
										})}
										{/* Main cutout */}
										<Line
											key={`main-${place._id}`}
											points={flatPoints}
											closed
											fill="black"
											listening={false}
											globalCompositeOperation="destination-out"
											tension={0.6}
										/>
									</React.Fragment>
								);
							})}
					</Layer>

					<Layer>
						{/* Render existing regions (polygons) - interaction and borders */}
						{places
							.filter(
								(p) =>
									p.placeType === 'region' &&
									p.coordinates?.type === 'polygon'
							)
							.map((place) => {
								const points = place.coordinates!.data.points!;
								const flatPoints = points.flatMap((p) => {
									const screen = toScreenCoords(p.x, p.y);
									return [screen.x, screen.y];
								});
								const isHovered = hoveredPlace === place._id;
								const isSelected = selectedRegionId === place._id;
								const shouldReveal = isHovered || isSelected;

								return (
									<Group key={place._id}>
										{/* Invisible hitbox for interaction */}
										<Line
											points={flatPoints}
											closed
											stroke="transparent"
											strokeWidth={0}
											fill="transparent"
											onClick={(e: any) => {
												if (isEditingPolygon) return; // Disable clicks during polygon edit
												handleRegionClick(place, e);
											}}
											onTap={() => {
												if (isEditingPolygon) return; // Disable taps during polygon edit
												mode === 'view' && handleRegionClick(place, {});
											}}
											onDblClick={(e: any) => {
												if (isEditingPolygon || mode !== 'edit') return; // Disable during polygon edit
												// Cancel any pending single-click timeout
												if (clickTimeoutRef.current) {
													clearTimeout(clickTimeoutRef.current);
													clickTimeoutRef.current = null;
												}
												const stage = e.target.getStage();
												const pointerPos = stage.getPointerPosition();
												let anchorClient: { x: number; y: number } | undefined;
												if (containerRef.current && pointerPos) {
													const rect = containerRef.current.getBoundingClientRect();
													anchorClient = { x: rect.left + pointerPos.x, y: rect.top + pointerPos.y };
												}
												onPlaceDoubleClick?.(place, anchorClient);
											}}
											onDblTap={(e: any) => {
												if (isEditingPolygon || mode !== 'edit') return; // Disable during polygon edit
												// Cancel any pending single-click timeout
												if (clickTimeoutRef.current) {
													clearTimeout(clickTimeoutRef.current);
													clickTimeoutRef.current = null;
												}
												const stage = e.target.getStage();
												const pointerPos = stage.getPointerPosition();
												let anchorClient: { x: number; y: number } | undefined;
												if (containerRef.current && pointerPos) {
													const rect = containerRef.current.getBoundingClientRect();
													anchorClient = { x: rect.left + pointerPos.x, y: rect.top + pointerPos.y };
												}
												onPlaceDoubleClick?.(place, anchorClient);
											}}
											onMouseEnter={(e: any) => {
												if (isEditingPolygon) return; // Disable hover during polygon edit
												setHoveredPlace(place._id);
												const container = e.target.getStage().container();
												container.style.cursor = 'pointer';
											}}
											onMouseLeave={(e: any) => {
												if (isEditingPolygon) return; // Disable hover during polygon edit
												setHoveredPlace(null);
												const container = e.target.getStage().container();
												container.style.cursor = 'default';
											}}
										/>

										{/* Show polygon lines and control points when editing this region's polygon */}
										{isEditingPolygon && editingRegionId === place._id && (
											<>
												{/* Polygon outline */}
												<Line
													points={flatPoints}
													closed
													stroke="#667eea"
													strokeWidth={3 / stageConfig.scale}
													dash={[10 / stageConfig.scale, 5 / stageConfig.scale]}
													listening={false}
												/>
												
												{/* Control points */}
												{points.map((point, index) => {
													const screen = toScreenCoords(point.x, point.y);
													return (
														<Circle
															key={`control-${index}`}
															x={screen.x}
															y={screen.y}
															radius={8 / stageConfig.scale}
															fill="#4a90e2"
															stroke="#ffffff"
															strokeWidth={2 / stageConfig.scale}
															draggable
															onDragStart={(e: any) => {
																e.cancelBubble = true;
																setDraggingPointIndex(index);
															}}
															onDragMove={(e: any) => {
																e.cancelBubble = true;
																const stage = e.target.getStage();
																const pointerPos = stage.getPointerPosition();
																if (!pointerPos || !image) return;

																// Convert screen coords back to normalized
																const normalized = toNormalizedCoords(
																	(pointerPos.x - stageConfig.x) / stageConfig.scale,
																	(pointerPos.y - stageConfig.y) / stageConfig.scale
																);

																// Update the points array
																const newPoints = [...points];
																newPoints[index] = { x: normalized.x, y: normalized.y };
																
																// Call the update handler
																onRegionPolygonUpdate?.(place, newPoints);
															}}
															onDragEnd={(e: any) => {
																e.cancelBubble = true;
																setDraggingPointIndex(null);
															}}
															onMouseEnter={(e: any) => {
																const container = e.target.getStage().container();
														container.style.cursor = 'move';
													}}
													onMouseLeave={(e: any) => {
														if (draggingPointIndex === null) {
															const container = e.target.getStage().container();
															container.style.cursor = 'default';
														}
													}}
												/>
											);
										})}
											</>
										)}
									</Group>
								);
							})}

						{/* Render existing cities (points) */}
						{places
							.filter(
								(p) =>
									p.placeType === 'city' &&
									p.coordinates?.type === 'point' &&
									// In view mode: only show cities if a region is selected AND city belongs to that region
									// In edit mode: show all cities
									(mode === 'edit' || (selectedRegionId && (
										p.coordinates?.parentRegionId === selectedRegionId ||
										// Fallback: check if city is inside the selected region geometrically
										places.find(region => 
											region._id === selectedRegionId && 
											region.coordinates?.type === 'polygon' &&
											region.coordinates.data.points &&
											isPointInPolygon(
												p.coordinates!.data.x!,
												p.coordinates!.data.y!,
												region.coordinates.data.points
											)
										)
									)))
							)
							.map((place) => {
								const screen = toScreenCoords(
									place.coordinates!.data.x!,
									place.coordinates!.data.y!
								);
								const isHovered = hoveredPlace === place._id;

								return (
									<CityPoint
										key={place._id}
										place={place}
										screen={screen}
										isHovered={isHovered}
										scale={stageConfig.scale}
										mode={mode}
										image={image}
										stageConfig={stageConfig}
										onPlaceClick={onPlaceClick}
										onCityDoubleClick={onCityDoubleClick}
										onCityDrag={onCityDrag}
										clickTimeoutRef={clickTimeoutRef}
										containerRef={containerRef}
										setHoveredPlace={setHoveredPlace}
									/>
								);
							})}

						{/* Render temporary region preview (while editing in modal) */}
						{tempRegion && (
							<Line
								points={tempRegion.points.flatMap((p) => {
									const screen = toScreenCoords(p.x, p.y);
									return [screen.x, screen.y];
								})}
								closed
								stroke={tempRegion.borderColor}
								strokeWidth={2 / stageConfig.scale}
								fill={tempRegion.fillColor}
							/>
						)}

						{/* Draw current polygon being created */}
						{isDrawingPolygon && polygonPoints.length > 0 && (
							<>
								{/* Polygon outline */}
								<Line
									points={polygonPoints.flatMap((p) => {
										const screen = toScreenCoords(p.x, p.y);
										return [screen.x, screen.y];
									})}
									stroke="#00ff00"
									strokeWidth={2 / stageConfig.scale}
									lineCap="round"
									lineJoin="round"
									closed={false}
									fill="transparent"
								/>
								{/* Points - clickable to complete */}
								{polygonPoints.map((p, i) => {
									const screen = toScreenCoords(p.x, p.y);
									return (
										<Circle
											key={i}
											x={screen.x}
											y={screen.y}
											radius={6 / stageConfig.scale}
											fill="#00ff00"
											stroke="#ffffff"
											strokeWidth={2 / stageConfig.scale}
										/>
									);
								})}
								{/* Line preview from last point to current mouse position */}
								{currentMousePos && (
									<>
										{(() => {
											const lastPoint = toScreenCoords(
												polygonPoints[
													polygonPoints.length - 1
												].x,
												polygonPoints[
													polygonPoints.length - 1
												].y
											);
											const currentPoint = toScreenCoords(
												currentMousePos.x,
												currentMousePos.y
											);
											return (
												<Line
													points={[
														lastPoint.x,
														lastPoint.y,
														currentPoint.x,
														currentPoint.y,
													]}
													stroke="#00ff00"
													strokeWidth={
														1 / stageConfig.scale
													}
													dash={[
														10 / stageConfig.scale,
														5 / stageConfig.scale,
													]}
													opacity={0.6}
												/>
											);
										})()}
									</>
								)}
							</>
						)}

						{/* Draw line preview when starting to drag (first point) */}
						{!isDrawingPolygon &&
							isDragging &&
							dragStartPos.current &&
							currentMousePos && (
								<>
									{(() => {
										const startPoint = toScreenCoords(
											dragStartPos.current.x,
											dragStartPos.current.y
										);
										const currentPoint = toScreenCoords(
											currentMousePos.x,
											currentMousePos.y
										);
										return (
											<Line
												points={[
													startPoint.x,
													startPoint.y,
													currentPoint.x,
													currentPoint.y,
												]}
												stroke="#00ff00"
												strokeWidth={
													2 / stageConfig.scale
												}
												opacity={0.8}
											/>
										);
									})()}
								</>
							)}
					</Layer>
				</Stage>
			)}
		</div>
	);
};

export default InteractiveMapCanvas;

// Helper component for rendering a city point with optional icon
const CityPoint: React.FC<{
	place: PlacePage;
	screen: { x: number; y: number };
	isHovered: boolean;
	scale: number;
	mode: 'view' | 'edit';
	image: HTMLImageElement | undefined;
	stageConfig: { x: number; y: number; scale: number };
	onPlaceClick?: (place: PlacePage) => void;
	onCityDoubleClick?: (place: PlacePage, anchorClient?: { x: number; y: number }) => void;
	onCityDrag?: (place: PlacePage, normalizedX: number, normalizedY: number) => void;
	clickTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
	containerRef: React.RefObject<HTMLDivElement>;
	setHoveredPlace: (id: string | null) => void;
}> = ({
	place,
	screen,
	isHovered,
	scale,
	mode,
	image,
	stageConfig,
	onPlaceClick,
	onCityDoubleClick,
	onCityDrag,
	clickTimeoutRef,
	containerRef,
	setHoveredPlace,
}) => {
	const [assetUrl, setAssetUrl] = useState<string | null>(null);

	// Get assets from store
	const assets = useAppStore((s) => s.data.assets.data);
	const loadAssets = useAppStore((s) => s.loadAssets);

	// Fetch asset URL from store when assetId changes
	useEffect(() => {
		if (!place.assetId) {
			setAssetUrl(null);
			return;
		}

		// Load assets if not in store
		if (assets.length === 0) {
			loadAssets();
			return;
		}

		// Find asset in store
		const asset = assets.find((a) => a._id === place.assetId);
		if (asset && asset.url) {
			setAssetUrl(Api.resolveAssetUrl(asset.url));
		}
	}, [place.assetId, assets, loadAssets]);

	// Load the asset image if URL is available
	const [iconImage] = useImage(assetUrl || '', 'anonymous');

	const maxIconSize = isHovered ? 96 : 80;
	const radius = isHovered ? 10 / scale : 8 / scale;

	// Calculate scaled dimensions maintaining aspect ratio
	let iconWidth = maxIconSize / scale;
	let iconHeight = maxIconSize / scale;
	
	if (iconImage) {
		const aspectRatio = iconImage.width / iconImage.height;
		if (aspectRatio > 1) {
			// Wider than tall
			iconWidth = maxIconSize / scale;
			iconHeight = iconWidth / aspectRatio;
		} else {
			// Taller than wide or square
			iconHeight = maxIconSize / scale;
			iconWidth = iconHeight * aspectRatio;
		}
	}

	// Handle drag end to update city position
	const handleDragEnd = (e: any) => {
		if (!image || !onCityDrag) return;

		const node = e.target;
		const newX = node.x();
		const newY = node.y();

		// Node coordinates are already in image/layer space; just normalize by image size
		const normalizedX = newX / image.width;
		const normalizedY = newY / image.height;

		// Clamp to [0, 1]
		const clampedX = Math.max(0, Math.min(1, normalizedX));
		const clampedY = Math.max(0, Math.min(1, normalizedY));

		onCityDrag(place, clampedX, clampedY);
	};

	return (
		<Group
			draggable={mode === 'edit'}
			x={screen.x}
			y={screen.y}
			// Prevent stage click/create-city after a drag by stopping bubbling at the group level
			onDragStart={(e: any) => {
				e.cancelBubble = true;
				// If there is any pending single-click timer, cancel it
				if (clickTimeoutRef.current) {
					clearTimeout(clickTimeoutRef.current);
					clickTimeoutRef.current = null;
				}
			}}
			onDragMove={(e: any) => {
				e.cancelBubble = true;
			}}
			onDragEnd={(e: any) => {
				e.cancelBubble = true;
				// Also clear any pending click timer to avoid treating drag-end as a click
				if (clickTimeoutRef.current) {
					clearTimeout(clickTimeoutRef.current);
					clickTimeoutRef.current = null;
				}
				handleDragEnd(e);
			}}
			onMouseDown={(e: any) => { e.cancelBubble = true; }}
			onMouseUp={(e: any) => { e.cancelBubble = true; }}
			onClick={(e: any) => { 
				// Swallow stray click events (e.g., the implicit click fired after a drag)
				e.cancelBubble = true; 
			}}
		>
			{/* Render icon if available, otherwise circle */}
			{iconImage && place.assetId ? (
				<KonvaImage
					image={iconImage}
					x={-iconWidth / 2}
					y={-iconHeight / 2}
					width={iconWidth}
					height={iconHeight}
					onClick={(e: any) => {
						e.cancelBubble = true;
						if (mode === 'view' && e.evt && e.evt.button === 0) {
							onPlaceClick?.(place);
						}
					}}
					onTap={(e: any) => {
						e.cancelBubble = true;
						if (mode === 'view') onPlaceClick?.(place);
					}}
					onDblClick={(e: any) => {
						if (mode === 'edit') {
							e.cancelBubble = true;
							if (clickTimeoutRef.current) {
								clearTimeout(clickTimeoutRef.current);
								clickTimeoutRef.current = null;
							}
							const stage = e.target.getStage();
							const pointerPos = stage.getPointerPosition();
							let anchorClient: { x: number; y: number } | undefined;
							if (containerRef.current && pointerPos) {
								const rect = containerRef.current.getBoundingClientRect();
								anchorClient = { x: rect.left + pointerPos.x, y: rect.top + pointerPos.y };
							}
							onCityDoubleClick?.(place, anchorClient);
						}
					}}
					onDblTap={(e: any) => {
						if (mode === 'edit') {
							e.cancelBubble = true;
							if (clickTimeoutRef.current) {
								clearTimeout(clickTimeoutRef.current);
								clickTimeoutRef.current = null;
							}
							const stage = e.target.getStage();
							const pointerPos = stage.getPointerPosition();
							let anchorClient: { x: number; y: number } | undefined;
							if (containerRef.current && pointerPos) {
								const rect = containerRef.current.getBoundingClientRect();
								anchorClient = { x: rect.left + pointerPos.x, y: rect.top + pointerPos.y };
							}
							onCityDoubleClick?.(place, anchorClient);
						}
					}}
					onMouseEnter={() => setHoveredPlace(place._id)}
					onMouseLeave={() => setHoveredPlace(null)}
				/>
			) : (
				<Circle
					x={0}
					y={0}
					radius={radius}
					fill={place.coordinates?.fillColor || (isHovered ? '#e6c896' : '#c9a96e')}
					stroke={place.coordinates?.borderColor || '#ffffff'}
					strokeWidth={2 / scale}
					onClick={(e: any) => {
						e.cancelBubble = true;
						if (mode === 'view' && e.evt && e.evt.button === 0) {
							onPlaceClick?.(place);
						}
					}}
					onTap={(e: any) => {
						e.cancelBubble = true;
						if (mode === 'view') onPlaceClick?.(place);
					}}
					onDblClick={(e: any) => {
						if (mode === 'edit') {
							e.cancelBubble = true;
							if (clickTimeoutRef.current) {
								clearTimeout(clickTimeoutRef.current);
								clickTimeoutRef.current = null;
							}
							const stage = e.target.getStage();
							const pointerPos = stage.getPointerPosition();
							let anchorClient: { x: number; y: number } | undefined;
							if (containerRef.current && pointerPos) {
								const rect = containerRef.current.getBoundingClientRect();
								anchorClient = { x: rect.left + pointerPos.x, y: rect.top + pointerPos.y };
							}
							onCityDoubleClick?.(place, anchorClient);
						}
					}}
					onDblTap={(e: any) => {
						if (mode === 'edit') {
							e.cancelBubble = true;
							if (clickTimeoutRef.current) {
								clearTimeout(clickTimeoutRef.current);
								clickTimeoutRef.current = null;
							}
							const stage = e.target.getStage();
							const pointerPos = stage.getPointerPosition();
							let anchorClient: { x: number; y: number } | undefined;
							if (containerRef.current && pointerPos) {
								const rect = containerRef.current.getBoundingClientRect();
								anchorClient = { x: rect.left + pointerPos.x, y: rect.top + pointerPos.y };
							}
							onCityDoubleClick?.(place, anchorClient);
						}
					}}
					onMouseEnter={() => setHoveredPlace(place._id)}
					onMouseLeave={() => setHoveredPlace(null)}
				/>
			)}
			{/* Label - always visible when hovered */}
			{/* {isHovered && (
				<Text
					x={12 / scale}
					y={-7 / scale}
					text={place.title}
					fontSize={14 / scale}
					fontStyle="bold"
					fill="#e6c896"
					onClick={(e: any) => {
						e.cancelBubble = true;
						if (e.evt && e.evt.button === 0) {
							onPlaceClick?.(place);
						}
					}}
					onTap={(e: any) => {
						e.cancelBubble = true;
						onPlaceClick?.(place);
					}}
				/>
			)} */}
		</Group>
	);
};
