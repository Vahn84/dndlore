import React, { useEffect, useState } from 'react';
import {
	BrowserRouter,
	Routes,
	Route,
	useLocation,
	useNavigate,
} from 'react-router-dom';
import Timeline from './components/Timeline';
import EventModal from './components/EventModal';
import GroupModal from './components/GroupModal';
import TimeSystemModal from './components/TimeSystemModal';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import Campaign from './pages/Campaign';
import History from './pages/History';
import ToasterHost from './components/ToasterHost';
import Api from './Api';
import { useAppStore } from './store/appStore';
import LoreHome from './pages/LoreHome';
import { SignIn, SignOut, UserCircle } from 'phosphor-react';
import LoreDetail from './pages/LoreDetail';

/**
 * The main application component. This version uses React Router to provide
 * separate routes for a landing page and the timeline editor. It maintains
 * state for events, groups, and the time system and exposes functions to
 * child components. It also renders the global navigation bar and login
 * button.
 */
const AppContent: React.FC = () => {
	// State for groups, events, time system

	const location = useLocation();
	const navigate = useNavigate();
	const setUser = useAppStore((s) => s.setUser);

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
				if (me) setUser({ ...me, token: tok });
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

	const loadGroups = useAppStore((s) => s.loadGroups);
	const loadEvents = useAppStore((s) => s.loadEvents);
	const loadTimeSystem = useAppStore((s) => s.loadTimeSystem);
	const loadAssets = useAppStore((s) => s.loadAssets);
	const logout = useAppStore((s) => s.logout);
	const isDM = useAppStore((s) => s.isDM);
	const isLoggedIn = useAppStore((s) => s.isLoggedIn);

	useEffect(() => {
		loadGroups();
		loadEvents();
		loadTimeSystem();
		loadAssets();
	}, [loadGroups, loadEvents, loadTimeSystem]);

	const handleGoogleLogin = () => {
		if (!isLoggedIn()) {
			window.location.href = `${Api.getBaseUrl()}/auth/google`;
		} else {
			logout();
		}
	};

	return (
		<>
			{/* Login button/icon top right */}
			<div className="loginContainer">
				{/* In a real app this would trigger an authentication flow */}
				<button
					className="loginButton"
					title="Login"
					onClick={handleGoogleLogin}
				>
					<span className="icon_square-btn">
						{isLoggedIn() ? <SignOut /> : <SignIn />}
					</span>
				</button>
			</div>
			{/* Main content container with padding to avoid overlap with nav bar */}
			<div
				className={`appContent ${
					location.pathname === '/' ? 'home' : 'other'
				}`}
			>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/campaign" element={<Campaign />} />
					<Route path="/history" element={<History />} />
					<Route path="/lore" element={<LoreHome />} />
					<Route path="/lore/:type/new" element={<LoreDetail isDM={isDM()} />} />
					<Route path="/lore/:type/:id" element={<LoreDetail isDM={isDM()} />} />
				</Routes>
			</div>
			{/* Render modals outside Routes so they overlay correctly */}

			{/* Global navigation bar */}
			<NavBar />
			<ToasterHost />
		</>
	);
};

// Wrapper component to provide routing context. React Router hooks like
// useLocation can only be used inside this provider. Keeping AppContent
// separate makes it easier to organise state and logic.
const App: React.FC = () => (
	<BrowserRouter>
		<AppContent />
	</BrowserRouter>
);

export default App;
