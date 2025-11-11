import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';

interface MapCanvasProps {
	imageUrl: string;
	minZoom?: number;
	maxZoom?: number;
}

const MapCanvas: React.FC<MapCanvasProps> = ({
	imageUrl,
	minZoom = 0.5,
	maxZoom = 3,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
	const [image] = useImage(imageUrl);
	const [stageConfig, setStageConfig] = useState({
		x: 0,
		y: 0,
		scale: 1,
	});

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

	// Center image when it loads
	useEffect(() => {
		if (image && dimensions.width && dimensions.height) {
			const scale = Math.min(
				dimensions.width / image.width,
				dimensions.height / image.height,
				1
			);
			setStageConfig({
				x: (dimensions.width - image.width * scale) / 2,
				y: (dimensions.height - image.height * scale) / 2,
				scale,
			});
		}
	}, [image, dimensions]);

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

	return (
		<div
			ref={containerRef}
			style={{
				width: '100%',
				height: '100%',
				position: 'relative',
				overflow: 'hidden',
				backgroundColor: '#1a1a1a',
			}}
		>
			{dimensions.width > 0 && (
				<Stage
					width={dimensions.width}
					height={dimensions.height}
					scaleX={stageConfig.scale}
					scaleY={stageConfig.scale}
					x={stageConfig.x}
					y={stageConfig.y}
					draggable
					onWheel={handleWheel}
					onDragEnd={handleDragEnd}
				>
					<Layer>
						{image && <KonvaImage image={image} />}
					</Layer>
				</Stage>
			)}
		</div>
	);
};

export default MapCanvas;
