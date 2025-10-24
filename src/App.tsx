import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Timeline from './components/Timeline';
import EventModal from './components/EventModal';
import GroupModal from './components/GroupModal';
import TimeSystemModal from './components/TimeSystemModal';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import Campaign from './pages/Campaign';
import History from './pages/History';

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

	return (
		<>
			{/* Login button/icon top right */}
			<div className="loginContainer">
				{/* In a real app this would trigger an authentication flow */}
				<button className="loginButton" title="Login">
					🔒
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
				</Routes>
			</div>
			{/* Render modals outside Routes so they overlay correctly */}

			{/* Global navigation bar */}
			<NavBar />
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
