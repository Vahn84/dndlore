import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import '../styles/NavBar.scss';
import stylized_logo from '../assets/aetherium-logo.webp';
import { ArrowLeft, ArrowSquareLeft, CaretLeft } from 'phosphor-react';

/**
 * A navigation bar with brand and two links: History and Campaign. On the home
 * page the bar is positioned near the bottom of the viewport with larger
 * typography. On other pages it sticks to the top with a more compact
 * appearance. A smooth transition animates its vertical position when
 * navigating between routes.
 */
const NavBar: React.FC = () => {
	const location = useLocation();
	const onHome = location.pathname === '/';

	const segments = location.pathname.split('/').filter(Boolean);
	const root = segments[0];
	const categoryType = segments[1]; // e.g., 'place', 'history', etc.
	const isSubPage = segments.length >= 2 && root === 'lore';

	// Check if we came from the timeline
	const fromTimeline = location.state?.from === 'timeline';
	const backHref = fromTimeline
		? '/timeline'
		: categoryType
		? `/${root}?category=${categoryType}`
		: `/${root}`;
	const backLabel = fromTimeline
		? 'Back to Timeline'
		: root === 'lore'
		? 'Back to Wikilore'
		: 'Back to History';

	const navClass = onHome ? 'navBar is-home' : 'navBar other';

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
		<nav className={navClass}>
			{isSubPage && !onHome && (
				<NavLink
					to={backHref}
					className={`backLink ${onHome ? 'is-home' : 'other'}`}
					aria-label={backLabel}
				>
					<CaretLeft size={18} weight="thin" />
					<span>BACK</span>
				</NavLink>
			)}
			{/* History link */}
			<NavLink
				to="/timeline"
				style={{ textAlign: 'right' }}
				className={({ isActive }) => {
					const base = `navLink ${onHome ? 'is-home' : 'other'}`;
					return isActive ? `${base} active` : base;
				}}
			>
				TIMELINE
			</NavLink>
			{/* Brand in the center */}

			<NavLink
				to="/"
				className={`navLink brand ${onHome ? 'is-home' : 'other'}`}
			>
				{onHome ? (
					<object
						className="brand-logo"
						ref={svgRef}
						data={require('../assets/aetherium-logo-nostroke.svg')}
						type="image/svg+xml"
					/>
				) : (
					<img
						src={stylized_logo}
						className="brand-logo"
						alt="Aetherium Logo"
					/>
				)}
			</NavLink>

			{/* Lore link */}
			<NavLink
				to="/lore"
				className={({ isActive }) => {
					const base = `navLink ${onHome ? 'is-home' : 'other'}`;
					return isActive ? `${base} active` : base;
				}}
			>
				WIKILORE
			</NavLink>
		</nav>
	);
};

export default NavBar;
