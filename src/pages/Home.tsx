import React from 'react';

import '../styles/Home.scss';

/**
 * A simple landing page component. It displays a welcome message and leaves
 * space for a login button at the top right (handled by App). Feel free to
 * customise the contents of this page to fit your project.
 */
const Home: React.FC = () => {
	return (
		<div className="homepage">
			<div className="dark-bg"></div>
			<div className="overlay-radial"></div>
			<h1 className="homepage__title">Welcome to Aetherium</h1>
		</div>
	);
};

export default Home;
