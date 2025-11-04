import React, { useEffect, useRef } from 'react';

const TestSvg: React.FC = () => {
	const svgRef = useRef<HTMLObjectElement>(null);

	useEffect(() => {
		const objectElement = svgRef.current;
		if (!objectElement) return;

		const handleLoad = () => {
			const svgDocument = objectElement.contentDocument;
			if (!svgDocument) return;

			const svgElement = svgDocument.querySelector('svg');
			if (!svgElement) return;

			// Access the SVGator player API
			const svgatorPlayer = (svgElement as any).svgatorPlayer;
			if (svgatorPlayer) {
				// Play the animation
				svgatorPlayer.play();
			}
		};

		objectElement.addEventListener('load', handleLoad);

		return () => {
			objectElement.removeEventListener('load', handleLoad);
		};
	}, []);

	return (
		<div style={{ 
			width: '100vw', 
			height: '100vh', 
			display: 'flex', 
			alignItems: 'center', 
			justifyContent: 'center',
			background: 'linear-gradient(135deg, #0e1117 0%, #1b1f2a 100%)',
			position: 'relative',
			overflow: 'hidden'
		}}>
			<object 
				ref={svgRef}
				data={require('../assets/aetherium-logo-animated.svg')}
				type="image/svg+xml"
				style={{
					width: '500px',
					height: '500px',
					pointerEvents: 'none'
				}}
			/>
		</div>
	);
};

export default TestSvg;
