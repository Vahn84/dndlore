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

	static async getPage(id: string) {
		const res = await Api.client.get(`/pages/${id}`);
		return res.data;
	}

	static async createPage(payload: {
		title: string;
		type: 'place' | 'history' | 'myth' | 'people' | 'campaign';
		bannerUrl?: string;
		content: any[];
		hidden?: boolean;
		hiddenSections?: any[];
		draft?: boolean;
	}) {
		const res = await Api.client.post('/pages', payload);
		return res.data;
	}

	static async updatePage(payload: Partial<Page>) {
		const { _id, ...rest } = payload;
		const res = await Api.client.put(`/pages/${_id}`, rest);
		return res.data;
	}

	static async deletePage(id: string) {
		const resp = await Api.client.delete(`/pages/${id}`);
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
	static async createAssetFromFile(file: File) {
		const formData = new FormData();
		formData.append('file', file);
		const resp = await Api.client.post('/assets', formData, {
			headers: { 'Content-Type': 'multipart/form-data' },
		});
		return resp.data;
	}

	/**
	 * Create an asset by specifying a remote URL. Returns the created asset.
	 */
	static async createAssetFromUrl(url: string) {
		const resp = await Api.client.post('/assets', { url });
		return resp.data;
	}

	/**
	 * Delete an asset by id.
	 */
	static async deleteAsset(id: string) {
		const resp = await Api.client.delete(`/assets/${id}`);
		return resp.data;
	}

	static resolveAssetUrl(u: string) {
		if (!u) return '';
		return /^https?:\/\//i.test(u)
			? u
			: (process.env.REACT_APP_API_BASE_URL || '') + u;
	}
}

export default Api;
