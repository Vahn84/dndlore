import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import '../styles/NavBar.scss';
import logo from '../assets/aetherium_logo.png';

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

	console.log(process.env);

	const navClass = onHome ? 'navBar is-home' : 'navBar other';
	return (
		<nav className={navClass}>
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
				<img className="brand-logo" src={logo} alt="Aetherium Logo" />
			</NavLink>

			{/* Lore link */}
			<NavLink
				to="/lore"
				className={({ isActive }) => {
					const base = `navLink ${onHome ? 'is-home' : 'other'}`;
					return isActive ? `${base} active` : base;
				}}
			>
				LORE LIBRARY
			</NavLink>
		</nav>
	);
};

export default NavBar;
