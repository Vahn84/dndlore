import {
	Calendar,
	CalendarBlank,
	GlobeHemisphereWest,
	Sword,
} from 'phosphor-react';
import React from 'react';

export const ICONS: { [id: string]: React.ReactNode } = {
	calendar: <CalendarBlank />,
	sword: <Sword />,
	globe: <GlobeHemisphereWest />,
};

export const _changeIcon = (icon: string) => {
	switch (icon) {
		case 'calendar':
			return 'sword';
		case 'sword':
			return 'globe';
		case 'globe':
		default:
			return 'calendar';
			break;
	}
};
