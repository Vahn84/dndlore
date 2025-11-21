import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Page } from './types';

/**
 * Centralised API client. All HTTP calls to the backend should go through
 * this class. It automatically attaches the JWT token stored in
 * localStorage (if present) to each request.
 */
class Api {
	private static instance: AxiosInstance | null = null;
	static getBaseUrl() {
		return process.env.REACT_APP_API_BASE_URL || '/api';
	}
	/**
	 * Get or create the Axios instance. This ensures baseURL and headers are
	 * configured consistently across the application.
	 */
	private static get client(): AxiosInstance {
		if (!Api.instance) {
			const baseURL = process.env.REACT_APP_API_BASE_URL || '/api';
			Api.instance = axios.create({ baseURL });
			// Attach interceptor to include token on every request
			Api.instance.interceptors.request.use((config: any) => {
				const token = localStorage.getItem('token');
				if (token) {
					config.headers = config.headers || {};
					config.headers['Authorization'] = `Bearer ${token}`;
				}
				return config;
			});
			Api.instance.interceptors.response.use(
				(response) => response,
				(error) => {
					if (error.response && error.response.status === 401) {
						// Only trigger a global unauthorized flow for core auth endpoints.
						// Optional integration endpoints (Discord / Google calendars) may return 401 if not connected; we should NOT log the user out for those.
						const url: string = error.config?.url || '';
						const criticalAuthPaths = [
							'/auth/user',
							'/login',
							'/auth/refresh-google-token',
						];
						const isCritical = criticalAuthPaths.some((p) =>
							url.includes(p)
						);
						if (isCritical) {
							// Dispatch a custom event so the React app can update UI state (avoid circular import between Api and store)
							window.dispatchEvent(new Event('app:unauthorized'));
						}
					}
					return Promise.reject(error);
				}
			);
		}
		return Api.instance;
	}

	// -------------------------------------------------------------------------
	// Authentication
	// -------------------------------------------------------------------------
	/**
	 * Login using username/password (local authentication). Returns JWT token
	 * and user details.
	 */
	static async login(username: string, password: string) {
		const resp = await Api.client.post('/login', { username, password });
		const { token, user } = resp.data;
		localStorage.setItem('token', token);
		return { token, user };
	}

	/**
	 * Logout by removing the token from localStorage. You may also call the
	 * server endpoint to invalidate the session if necessary.
	 */
	static logout() {
		localStorage.removeItem('token');
		localStorage.clear();
	}

	/**
	 * Retrieve the current authenticated user from the backend. Returns null
	 * if not authenticated or token invalid.
	 */
	static async getCurrentUser() {
		try {
			const resp = await Api.client.get('/auth/user');
			return resp.data;
		} catch {
			return null;
		}
	}

	/**
	 * Check the status of the user's Google token connection.
	 * Returns: { connected, expired, tokenExpiry, needsReauth }
	 */
	static async checkGoogleTokenStatus() {
		try {
			const resp = await Api.client.get('/auth/google-token-status');
			return resp.data;
		} catch (error) {
			console.error('Failed to check Google token status:', error);
			return { connected: false, expired: true, needsReauth: true };
		}
	}

	/**
	 * Refresh the Google access token using the stored refresh token.
	 * Returns new token and updates localStorage.
	 */
	static async refreshGoogleToken() {
		try {
			const resp = await Api.client.post('/auth/refresh-google-token');
			const { token, googleAccessToken, tokenExpiry } = resp.data;

			// Update stored JWT token
			if (token) {
				localStorage.setItem('token', token);
			}

			return { success: true, token, googleAccessToken, tokenExpiry };
		} catch (error: any) {
			const needsReauth = error.response?.data?.needsReauth || false;
			return {
				success: false,
				needsReauth,
				error: error.response?.data?.error,
			};
		}
	}

	// -------------------------------------------------------------------------
	// Groups
	// -------------------------------------------------------------------------
	static async getGroups() {
		const resp = await Api.client.get('/groups');
		return resp.data;
	}

	static async createGroup(data: { name: string }) {
		const resp = await Api.client.post('/groups', data);
		return resp.data;
	}

	static async updateGroup(data: {
		_id: string;
		name?: string;
		order?: number;
		color?: string;
	}) {
		const resp = await Api.client.put(`/groups/${data._id}`, data);
		return resp.data;
	}

	static async reorderGroups(ids: string[]) {
		const resp = await Api.client.put('/groups', { newOrder: ids });
		return resp.data;
	}

	static async deleteGroup(id: string) {
		const resp = await Api.client.delete(`/groups/${id}`);
		return resp.data;
	}

	// -------------------------------------------------------------------------
	// Events
	// -------------------------------------------------------------------------
	static async getEvents() {
		const resp = await Api.client.get('/events');
		return resp.data;
	}

	static async createEvent(data: any) {
		const resp = await Api.client.post('/events', data);
		return resp.data;
	}

	static async updateEvent(data: any) {
		const resp = await Api.client.put(`/events/${data._id}`, data);
		return resp.data;
	}

	static async reorderEvents(ids: string[]) {
		const resp = await Api.client.put('/events/order', { newOrder: ids });
		return resp.data;
	}

	static async deleteEvent(id: string) {
		const resp = await Api.client.delete(`/events/${id}`);
		return resp.data;
	}

	// -------------------------------------------------------------------------
	// Pages
	// -------------------------------------------------------------------------
	static async getPages(type?: string) {
		const resp = await Api.client.get('/pages', {
			params: type ? { type } : {},
		});
		return resp.data;
	}

	static async searchPages(q: string, type?: string, limit: number = 50) {
		const params: any = { q, limit };
		if (type) params.type = type;
		const resp = await Api.client.get('/pages', { params });
		return resp.data as Page[];
	}

	static async getPage(id: string) {
		const res = await Api.client.get(`/pages/${id}`);
		return res.data;
	}

	static async createPage(payload: {
		title: string;
		subtitle?: string;
		type: 'place' | 'history' | 'myth' | 'people' | 'campaign';
		bannerUrl?: string;
		blocks: any[];
		hidden?: boolean;
		draft?: boolean;
	}) {
		const res = await Api.client.post('/pages', payload);
		return res.data;
	}

	static async updatePage(payload: Partial<Page>) {
		const { _id, ...rest } = payload;
		console.log('Updating page:', payload);
		const res = await Api.client.put(`/pages/${_id}`, rest);
		return res.data;
	}

	static async deletePage(id: string) {
		const resp = await Api.client.delete(`/pages/${id}`);
		return resp.data;
	}

	static async reorderPages(type: string, pageIds: string[]) {
		const resp = await Api.client.patch(`/pages/reorder/${type}`, {
			pageIds,
		});
		return resp.data;
	}

	// -------------------------------------------------------------------------
	// Time system
	// -------------------------------------------------------------------------
	static async getTimeSystem() {
		const resp = await Api.client.get('/time-system');
		return resp.data;
	}

	static async updateTimeSystem(data: any) {
		const resp = await Api.client.put('/time-system', data);
		return resp.data;
	}

	// -------------------------------------------------------------------------
	// File upload
	// -------------------------------------------------------------------------
	static async uploadFile(file: File) {
		const formData = new FormData();
		formData.append('file', file);
		const resp = await Api.client.post('/upload', formData, {
			headers: {
				'Content-Type': 'multipart/form-data',
			},
		});
		return resp.data;
	}

	// -------------------------------------------------------------------------
	// Assets (Asset Manager)
	// -------------------------------------------------------------------------
	static async getAssets() {
		const resp = await Api.client.get('/assets');
		return resp.data;
	}

	/**
	 * Create an asset from a local file. Returns the created asset { _id, url }.
	 */
	static async createAssetFromFile(file: File, folderId?: string | null) {
		const formData = new FormData();
		formData.append('file', file);
		if (folderId) {
			formData.append('folderId', folderId);
		}
		const resp = await Api.client.post('/assets', formData, {
			headers: { 'Content-Type': 'multipart/form-data' },
		});
		return resp.data;
	}

	/**
	 * Create an asset by specifying a remote URL. Returns the created asset.
	 */
	static async createAssetFromUrl(url: string, folderId?: string | null) {
		const payload: { url: string; folderId?: string | null } = { url };
		if (folderId) {
			payload.folderId = folderId;
		}
		const resp = await Api.client.post('/assets', payload);
		return resp.data;
	}

	/**
	 * Delete an asset by id.
	 */
	static async deleteAsset(id: string) {
		const resp = await Api.client.delete(`/assets/${id}`);
		return resp.data;
	}

	/**
	 * Move an asset to a different folder (or root if folderId is null).
	 */
	static async moveAssetToFolder(assetId: string, folderId: string | null) {
		const resp = await Api.client.patch(`/assets/${assetId}/move`, {
			folderId,
		});
		return resp.data;
	}

	// -------------------------------------------------------------------------
	// Asset Folders
	// -------------------------------------------------------------------------
	static async getAssetFolders() {
		const resp = await Api.client.get('/asset-folders');
		return resp.data;
	}

	static async createAssetFolder(name: string) {
		const resp = await Api.client.post('/asset-folders', { name });
		return resp.data;
	}

	static async deleteAssetFolder(id: string) {
		const resp = await Api.client.delete(`/asset-folders/${id}`);
		return resp.data;
	}

	static resolveAssetUrl(u: string) {
		u =
			process.env.NODE_ENV === 'production'
				? u
				: `http://localhost:3001${u}`;
		if (!u) return '';
		// If already absolute URL, return as-is
		if (/^https?:\/\//i.test(u)) return u;
		// All relative paths (including /uploads) are served through the same origin
		// nginx.conf proxies /uploads/ to backend
		return u;
	}

	/**
	 * Resolve thumbnail URL if available, otherwise fall back to original.
	 * Use this for list items, timeline events, and small cards.
	 * For page banners, use resolveAssetUrl instead.
	 */
	static resolveThumbnailUrl(url: string, bannerThumbUrl?: string) {
		const resolved = bannerThumbUrl || url;
		console.log('Resolved thumbnail URL:', resolved, bannerThumbUrl);
		return Api.resolveAssetUrl(resolved);
	}

	// -------------------------------------------------------------------------
	// Discord Integration (stubs)
	// -------------------------------------------------------------------------
	/**
	 * Fetch user's Google Calendar list
	 */
	static async getGoogleCalendars(): Promise<
		Array<{ id: string; name: string; primary: boolean }>
	> {
		try {
			const resp = await Api.client.get('/integrations/google/calendars');
			return resp.data;
		} catch (error) {
			console.warn('Google calendars API not available:', error);
			throw error;
		}
	}

	/**
	 * Attempt to retrieve Discord text channels from backend integration.
	 * Expected response: Array<{ id: string; name: string }>
	 */
	static async getDiscordChannels(): Promise<
		Array<{ id: string; name: string }>
	> {
		try {
			const resp = await Api.client.get('/integrations/discord/channels');
			return resp.data;
		} catch (error) {
			console.warn('Discord channels API not available:', error);
			throw error;
		}
	}

	/**
	 * Attempt to retrieve Discord voice channels from backend integration.
	 * Expected response: { guildId: string, channels: Array<{ id: string; name: string }> }
	 */
	static async getDiscordVoiceChannels(): Promise<{
		guildId: string;
		channels: Array<{ id: string; name: string }>;
	}> {
		try {
			const resp = await Api.client.get(
				'/integrations/discord/voice-channels'
			);
			return resp.data;
		} catch (error) {
			console.warn('Discord voice channels API not available:', error);
			throw error;
		}
	}

	/**
	 * Create a Discord scheduled event via backend integration (e.g., Apollo bot).
	 * Payload sample: { title, bannerUrl?, dateTimeUtc, channelId, syncToCalendar?, calendarId? }
	 */
	static async createDiscordEvent(payload: {
		title: string;
		bannerUrl?: string;
		dateTimeUtc: string; // ISO string (UTC)
		channelId: string;
		syncToCalendar?: boolean;
		calendarId?: string;
	}) {
		try {
			const resp = await Api.client.post(
				'/integrations/discord/events',
				payload
			);
			return resp.data;
		} catch (error) {
			console.warn('Discord event creation API not available:', error);
			throw error;
		}
	}
}

export default Api;
