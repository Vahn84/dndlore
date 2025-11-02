import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import '../styles/NavBar.scss';
import logo from '../assets/aetherium_logo.png';
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
	const backHref = categoryType ? `/${root}?category=${categoryType}` : `/${root}`;
	const backLabel = root === 'lore' ? 'Back to Wikilore' : 'Back to History';

	const navClass = onHome ? 'navBar is-home' : 'navBar other';
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
				to="/history"
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
				<img
					className="brand-logo"
					src={stylized_logo}
					alt="Aetherium Logo"
				/>
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
