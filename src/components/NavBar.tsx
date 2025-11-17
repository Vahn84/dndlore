import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import '../styles/NavBar.scss';
import stylized_logo from '../assets/aetherium-logo.webp';
import { ArrowLeft, ArrowSquareLeft, CaretLeft, SignIn, SignOut } from 'phosphor-react';
import Api from '../Api';
import { useAppStore } from '../store/appStore';

/**
 * A navigation bar with brand and two links: History and Campaign. On the home
 * page the bar is positioned near the bottom of the viewport with larger
 * typography. On other pages it sticks to the top with a more compact
 * appearance. A smooth transition animates its vertical position when
 * navigating between routes.
 */
const NavBar: React.FC = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const user = useAppStore((s) => s.user); // Subscribe to user state changes!
	const setUser = useAppStore((s) => s.setUser);
	const [googleStatus, setGoogleStatus] = useState<{
		connected: boolean;
		expired: boolean;
		checking: boolean;
	}>({ connected: false, expired: false, checking: false });

	useEffect(() => {
		// 1) Extract token returned by backend (e.g., http://app/?token=... or #token=...)
		const url = new URL(window.location.href);
		const fromQuery = url.searchParams.get('token');
		const fromHash = (() => {
			if (!url.hash) return null;
			const p = new URLSearchParams(url.hash.replace(/^#/, ''));
			return p.get('token');
		})();
		const token = fromQuery || fromHash;

		const cleanUrl = () => {
			if (fromQuery) {
				url.searchParams.delete('token');
			}
			if (fromHash) {
				const hp = new URLSearchParams(url.hash.replace(/^#/, ''));
				hp.delete('token');
				const newHash = hp.toString();
				url.hash = newHash ? `#${newHash}` : '';
			}
			const finalUrl =
				url.pathname +
				(url.search ? `?${url.searchParams.toString()}` : '') +
				url.hash;
			window.history.replaceState(null, '', finalUrl);
		};

		const hydrate = async (tok: string) => {
			try {
				localStorage.setItem('token', tok);
				const me = await Api.getCurrentUser();
				if (me) {
					setUser({ ...me, token: tok });
				}
			} catch (e) {
				console.error('Failed to hydrate user from token', e);
				localStorage.removeItem('token');
				setUser(null);
			} finally {
				cleanUrl();
			}
		};

		if (token) {
			void hydrate(token);
			return;
		}

		// 2) Try to hydrate from existing token (page refresh)
		const stored = localStorage.getItem('token');
		if (stored) {
			(async () => {
				try {
					const me = await Api.getCurrentUser();
					if (me) setUser({ ...me, token: stored });
				} catch (e) {
					localStorage.removeItem('token');
					setUser(null);
				}
			})();
		}
	}, [setUser]);

	const logout = useAppStore((s) => s.logout);
	const isDM = useAppStore((s) => s.isDM);
	const isLoggedIn = useAppStore((s) => s.isLoggedIn);
	

	// Listen for global unauthorized events dispatched by the API client interceptor
	useEffect(() => {
		const handler = () => {
			logout();
		};
		window.addEventListener('app:unauthorized', handler);
		return () => window.removeEventListener('app:unauthorized', handler);
	}, [logout]);

	// Check Google token status when user is logged in and auto-refresh if needed
	useEffect(() => {
		if (isLoggedIn() && isDM()) {
			setGoogleStatus((prev) => ({ ...prev, checking: true }));
			(async () => {
				try {
					const status = await Api.checkGoogleTokenStatus();
					// If user is not connected to Google at all, force logout
					if (!status.connected) {
						logout();
						setGoogleStatus({ connected: false, expired: true, checking: false });
						return;
					}

					// If token is expired, try to refresh; if refresh fails, log the user out
					if (status.expired) {
						const result = await Api.refreshGoogleToken();
						if (result.success && result.token) {
							localStorage.setItem('token', result.token);
							const me = await Api.getCurrentUser();
							if (me) setUser({ ...me, token: result.token });
							setGoogleStatus({ connected: true, expired: false, checking: false });
						} else {
							// Unable to refresh: force logout
							logout();
							localStorage.removeItem('token');
							setUser(null);
							setGoogleStatus({ connected: false, expired: true, checking: false });
						}
					} else {
						// Token valid
						setGoogleStatus({ connected: true, expired: false, checking: false });
					}
				} catch (e) {
					// On any error during token checks/refresh, log out to keep UI consistent
					logout();
					localStorage.removeItem('token');
					setUser(null);
					setGoogleStatus({ connected: false, expired: true, checking: false });
				}
			})();
		}
	}, [isLoggedIn, isDM, setUser, logout]);

	const handleGoogleLogin = () => {
		if (!isLoggedIn()) {
			window.location.href = `${Api.getBaseUrl()}/auth/google`;
		} else {
			logout();
		}
	};
	

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
					<CaretLeft size={window.innerWidth <= 600 ? 28 : 18} weight="thin" />
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
			{/* Login button/icon top right */}
			<div className={`loginContainer ${onHome ? 'hide' : ''}`}>
				{/* (Google reconnect prompt removed - user will be logged out if Google token can't be refreshed) */}
				{/* Login/Logout button */}
				<button
					className="loginButton"
					title={isLoggedIn() ? 'Logout' : 'Login with Google'}
					onClick={handleGoogleLogin}
				>
					{' '}
					<span className="loginButtonWrapper">
						<span className="loginButtonLabel">
							{isLoggedIn() ? 'Logout' : 'DM Login'}
						</span>
						<span className="icon_square-btn">
							{isLoggedIn() ? <SignOut /> : <SignIn />}
						</span>
					</span>
				</button>
			</div>
		</nav>
	);
};

export default NavBar;
