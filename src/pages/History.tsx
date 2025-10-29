import React from 'react';
import Timeline from '../components/Timeline';
import '../styles/History.scss';

const History: React.FC = () => {
	return (
		<div className="history">
			<div className="overlay"></div>
			<Timeline />
		</div>
	);
};

export default History;
