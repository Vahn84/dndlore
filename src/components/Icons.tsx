import { CalendarIcon } from '@phosphor-icons/react/dist/csr/Calendar';
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { GlobeHemisphereWestIcon } from '@phosphor-icons/react/dist/csr/GlobeHemisphereWest';
import { SwordIcon } from '@phosphor-icons/react/dist/csr/Sword';
import React from 'react';

export const ICONS: { [id: string]: React.ReactNode } = {
	calendar: <CalendarBlankIcon />,
	sword: <SwordIcon />,
	globe: <GlobeHemisphereWestIcon />,
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
