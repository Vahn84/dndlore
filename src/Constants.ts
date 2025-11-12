import LibraryBg from './assets/aetherium_library_bg.png';

export default class Constants {
	static LORE_BG: { [id: string]: string } = {
		history: LibraryBg,
		myth: LibraryBg,
		place: LibraryBg,
		people: LibraryBg,
		campaign: LibraryBg,
	};

	// FVTT Web Client URL - can be overridden by REACT_APP_FVTT_URL environment variable
	static FVTT_URL = process.env.REACT_APP_FVTT_URL || 'https://www.google.com';
}
