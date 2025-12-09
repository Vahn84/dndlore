import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import Api from '../Api';
import { Event, Group, Page } from '../types';

// Simple Asset type for the Asset Manager
export type Asset = { _id: string; url: string; thumb_url?: string; createdAt?: string; folderId?: string | null };
export type AssetFolder = { _id: string; name: string; createdAt?: string };

type Role = 'DM' | 'PLAYER';
type User = { 
	id?: string; 
	email?: string; 
	role?: Role; 
	token?: string;
	googleAccessToken?: string;
};

type Loadable<T> = {
	data: T;
	loading: boolean;
	error?: string | null;
};

type DataState = {
	groups: Loadable<Group[]>;
	events: Loadable<Event[]>;
	pages: Loadable<Page[]>;
	timeSystem: Loadable<any>;
	assets: Loadable<Asset[]>;
	assetFolders: Loadable<AssetFolder[]>;
};

type UIState = {
	showHidden: boolean;
	activeGroupIds: string[];
};

type AppState = {
	// --- slices ---
	user: User | null;
	ui: UIState;
	data: DataState;

	// --- derived ---
	isDM: () => boolean;
	isLoggedIn: () => boolean;

	// --- auth ---
	setUser: (u: User | null) => void;
	logout: () => void;

	// --- ui ---
	setShowHidden: (v: boolean) => void;
	toggleGroup: (id: string) => void;
	setGroupsFilter: (ids: string[]) => void;

	// --- load (API) ---
	loadGroups: () => Promise<void>;
	loadEvents: () => Promise<void>;
	loadPages: (type?: Page['type']) => Promise<void>;
	loadTimeSystem: () => Promise<void>;
	loadAssets: () => Promise<void>;
	loadAssetFolders: () => Promise<void>;

	// --- mutations (API) ---
	createGroup: (name: string, extras?: { color?: string; exclude?: boolean; orderAscending?: boolean; defaultSelected?: boolean }) => Promise<Group>;
	updateGroup: (g: {
		_id: string;
		name?: string;
		color?: string;
		exclude?: boolean;
		orderAscending?: boolean;
		defaultSelected?: boolean;
		order?: number;
	}) => Promise<Group>;
	deleteGroup: (id: string) => Promise<void>;
	reorderGroups: (ids: string[]) => Promise<void>;

	createEvent: (e: Omit<Event, '_id'>) => Promise<Event>;
	updateEvent: (e: Partial<Event>) => Promise<Event>;
	deleteEvent: (id: string) => Promise<void>;

	createPage: (p: Omit<Page, 'id'>) => Promise<Page>;
	updatePage: (p: Partial<Page>) => Promise<Page>;
	deletePage: (id: string) => Promise<void>;
	getPage: (id: string) => Promise<Page>;
	saveTimeSystem: (config: any) => Promise<void>;

	createAssetFromFile: (file: File, folderId?: string | null) => Promise<Asset>;
	createAssetFromUrl: (url: string, folderId?: string | null) => Promise<Asset>;
	deleteAsset: (id: string) => Promise<void>;
	moveAssetToFolder: (assetId: string, folderId: string | null) => Promise<void>;

	createAssetFolder: (name: string) => Promise<AssetFolder>;
	deleteAssetFolder: (id: string) => Promise<void>;

	// --- helpers ---
	replacePageInCache: (p: Page) => void;
};

const initialLoadable = <T>(data: T): Loadable<T> => ({
	data,
	loading: false,
	error: null,
});

export const useAppStore = create<AppState>()(
	devtools(
		persist(
			immer((set, get) => ({
				// --- initial state ---
				user: null,
				ui: { showHidden: false, activeGroupIds: [] },
			data: {
				groups: initialLoadable<Group[]>([]),
				events: initialLoadable<Event[]>([]),
				pages: initialLoadable<Page[]>([]),
				timeSystem: initialLoadable<any>(null),
				assets: initialLoadable<Asset[]>([]),
				assetFolders: initialLoadable<AssetFolder[]>([]),
			},				// --- derived ---
				isDM: () => get().user?.role === 'DM',
				isLoggedIn: () =>
					get().user !== null && get().user?.token !== null,

				// --- auth ---
				setUser: (u) => set({ user: u }),
				logout: () =>
					set((s) => {
						// reset anche preferenze “per sicurezza”
						s.user = null;
						s.ui.showHidden = false;
						localStorage.clear();
						return s;
					}),

				// --- ui ---
				setShowHidden: (v) =>
					set((s) => {
						s.ui.showHidden = v;
					}),
				toggleGroup: (id: string) =>
					set((s) => {
						if (!id || typeof id !== 'string') return;
						const has = s.ui.activeGroupIds.includes(id);
						const next = has
							? s.ui.activeGroupIds.filter((x) =>
									x === id ? false : true
							  )
							: [...s.ui.activeGroupIds, id];
						// sanitize & dedupe
						s.ui.activeGroupIds = Array.from(
							new Set(
								next.filter(
									(x): x is string =>
										typeof x === 'string' && !!x
								)
							)
						);
					}),
				setGroupsFilter: (ids) =>
					set((s) => {
						const cleaned = ids.filter(
							(x): x is string => typeof x === 'string' && !!x
						);
						s.ui.activeGroupIds = Array.from(new Set(cleaned));
					}),

				// --- loaders ---
				loadGroups: async () => {
					set((s) => {
						s.data.groups.loading = true;
						s.data.groups.error = null;
					});
					try {
						const groups = await Api.getGroups();
						set((s) => {
							s.data.groups.data = groups;
							// keep only ids that exist in the freshly loaded groups
							const validIds = new Set(
								groups.map((g: Group) => g._id)
							);
							s.ui.activeGroupIds = s.ui.activeGroupIds.filter(
								(id) => validIds.has(id)
							);
						});
					} catch (e: any) {
						set((s) => {
							s.data.groups.error =
								e?.message || 'Failed to load groups';
						});
					} finally {
						set((s) => {
							s.data.groups.loading = false;
						});
					}
				},

				loadEvents: async () => {
					set((s) => {
						s.data.events.loading = true;
						s.data.events.error = null;
					});
					try {
						const allEvents = await Api.getEvents();
						const events = allEvents.filter(
							(e: Event) => !e.hidden || get().user?.role === 'DM'
						);
						set((s) => {
							s.data.events.data = events;
						});
					} catch (e: any) {
						set((s) => {
							s.data.events.error =
								e?.message || 'Failed to load events';
						});
					} finally {
						set((s) => {
							s.data.events.loading = false;
						});
					}
				},

				loadPages: async (type) => {
					set((s) => {
						s.data.pages.loading = true;
						s.data.pages.error = null;
					});
					try {
						const pages = type
							? await Api.getPages(type)
							: await Api.getPages();
						set((s) => {
							s.data.pages.data = pages;
						});
					} catch (e: any) {
						set((s) => {
							s.data.pages.error =
								e?.message || 'Failed to load pages';
						});
					} finally {
						set((s) => {
							s.data.pages.loading = false;
						});
					}
				},

				loadTimeSystem: async () => {
					set((s) => {
						s.data.timeSystem.loading = true;
						s.data.timeSystem.error = null;
					});
					try {
						const cfg = await Api.getTimeSystem();
						set((s) => {
							s.data.timeSystem.data = cfg;
						});
					} catch (e: any) {
						set((s) => {
							s.data.timeSystem.error =
								e?.message || 'Failed to load time system';
						});
					} finally {
						set((s) => {
							s.data.timeSystem.loading = false;
						});
					}
				},

				loadAssets: async () => {
					set((s) => {
						// initialize slice defensively (in case rehydrate replaced data object)
						// @ts-ignore — immer draft typing
						if (!s.data.assets)
							s.data.assets = initialLoadable<Asset[]>([]);
						s.data.assets.loading = true;
						s.data.assets.error = null;
					});
					try {
						const list = await Api.getAssets();
						set((s) => {
							s.data.assets.data = Array.isArray(list)
								? list
								: [];
						});
					} catch (e: any) {
						set((s) => {
							s.data.assets.error =
								e?.message || 'Failed to load assets';
						});
					} finally {
						set((s) => {
							s.data.assets.loading = false;
						});
					}
				},

				saveTimeSystem: async (config) => {
					const anyApi = Api as any;
					const fn = anyApi.saveTimeSystem || anyApi.updateTimeSystem;
					if (typeof fn !== 'function')
						throw new Error('TimeSystem API not implemented');
					const updated = await fn(config);
					set((s) => {
						s.data.timeSystem.data = updated;
					});
				},

				createAssetFromFile: async (file, folderId) => {
					const created = await Api.createAssetFromFile(file, folderId);
					if (!created || !created._id)
						throw new Error('Failed to create asset');
					set((s) => {
						// @ts-ignore
						if (!s.data.assets)
							s.data.assets = initialLoadable<Asset[]>([]);
						s.data.assets.data = [created, ...s.data.assets.data];
					});
					return created as Asset;
				},

				createAssetFromUrl: async (url, folderId) => {
					const created = await Api.createAssetFromUrl(url, folderId);
					if (!created || !created._id)
						throw new Error('Failed to create asset');
					set((s) => {
						// @ts-ignore
						if (!s.data.assets)
							s.data.assets = initialLoadable<Asset[]>([]);
						s.data.assets.data = [created, ...s.data.assets.data];
					});
					return created as Asset;
				},

			deleteAsset: async (id) => {
				await Api.deleteAsset(id);
				set((s) => {
					// @ts-ignore
					if (!s.data.assets)
						s.data.assets = initialLoadable<Asset[]>([]);
					s.data.assets.data = s.data.assets.data.filter(
						(a) => a._id !== id
					);
				});
			},

			moveAssetToFolder: async (assetId, folderId) => {
				const updated = await Api.moveAssetToFolder(assetId, folderId);
				set((s) => {
					// @ts-ignore
					if (!s.data.assets)
						s.data.assets = initialLoadable<Asset[]>([]);
					const idx = s.data.assets.data.findIndex((a) => a._id === assetId);
					if (idx >= 0) {
						s.data.assets.data[idx] = updated;
					}
				});
			},

			loadAssetFolders: async () => {
				set((s) => {
					// @ts-ignore
					if (!s.data.assetFolders)
						s.data.assetFolders = initialLoadable<AssetFolder[]>([]);
					s.data.assetFolders.loading = true;
					s.data.assetFolders.error = null;
				});
				try {
					const list = await Api.getAssetFolders();
					set((s) => {
						s.data.assetFolders.data = Array.isArray(list) ? list : [];
					});
				} catch (e: any) {
					set((s) => {
						s.data.assetFolders.error = e?.message || 'Failed to load folders';
					});
				} finally {
					set((s) => {
						s.data.assetFolders.loading = false;
					});
				}
			},

			createAssetFolder: async (name) => {
				const created = await Api.createAssetFolder(name);
				if (!created || !created._id)
					throw new Error('Failed to create folder');
				set((s) => {
					// @ts-ignore
					if (!s.data.assetFolders)
						s.data.assetFolders = initialLoadable<AssetFolder[]>([]);
					s.data.assetFolders.data = [created, ...s.data.assetFolders.data];
				});
				return created as AssetFolder;
			},

			deleteAssetFolder: async (id) => {
				await Api.deleteAssetFolder(id);
				set((s) => {
					// @ts-ignore
					if (!s.data.assetFolders)
						s.data.assetFolders = initialLoadable<AssetFolder[]>([]);
					s.data.assetFolders.data = s.data.assetFolders.data.filter(
						(f) => f._id !== id
					);
				});
			},				// --- mutations ---
				createGroup: async (name, extras = {}) => {
					const created = await Api.createGroup({ name, ...extras });
					set((s) => {
						s.data.groups.data.push(created);
					});
					return created;
				},

				updateGroup: async (g) => {
					console.log('Updating group in store:', g);
					const upd = await Api.updateGroup(g);
					set((s) => {
						s.data.groups.data = s.data.groups.data.map((x) => {
							if (x._id === upd._id) return upd;
							// Mirror backend behavior: only one default at a time
							if (upd.defaultSelected) {
								return { ...x, defaultSelected: false };
							}
							return x;
						});
					});
					return upd;
				},

				deleteGroup: async (id) => {
					await Api.deleteGroup(id);
					set((s) => {
						s.data.groups.data = s.data.groups.data.filter(
							(x) => x._id !== id
						);
						s.data.events.data = s.data.events.data.filter(
							(ev) => ev.groupId !== id
						);
					});
				},

				reorderGroups: async (ids) => {
					const prev = get().data.groups.data;
					// optimistic: set order locally
					set((s) => {
						const map = new Map(
							ids.map((id, idx) => [id, idx] as const)
						);
						s.data.groups.data = s.data.groups.data
							.map((g) => ({
								...g,
								order: map.get(g._id) ?? g.order,
							}))
							.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
					});
					try {
						const anyApi = Api as any;
						if (typeof anyApi.reorderGroups === 'function') {
							await anyApi.reorderGroups(ids);
						} else {
							// fallback: update each group order individually
							await Promise.all(
								ids.map((id, idx) =>
									Api.updateGroup({ _id: id, order: idx })
								)
							);
						}
					} catch (err) {
						// rollback on error
						set((s) => {
							s.data.groups.data = prev;
						});
						throw err;
					}
				},

				createEvent: async (e) => {
					// opzionale: update ottimistico
					const tempId = `tmp_${Date.now()}`;
					set((s) => {
						s.data.events.data.push({ ...e, _id: tempId } as Event);
					});

					try {
						const created = await Api.createEvent(e);
						set((s) => {
							s.data.events.data = s.data.events.data.map((x) =>
								x._id === tempId ? created : x
							);
						});
						return created;
					} catch (err) {
						// rollback
						set((s) => {
							s.data.events.data = s.data.events.data.filter(
								(x) => x._id !== tempId
							);
						});
						throw err;
					}
				},

				updateEvent: async (e) => {
					console.log('Updating event in store:', e);
					const upd = await Api.updateEvent(e);
					set((s) => {
						s.data.events.data = s.data.events.data.map((x) =>
							x._id === upd._id ? upd : x
						);
					});
					return upd;
				},

				deleteEvent: async (id) => {
					const prev = get().data.events.data;
					set((s) => {
						s.data.events.data = s.data.events.data.filter(
							(x) => x._id !== id
						);
					});
					try {
						await Api.deleteEvent(id);
					} catch (err) {
						// rollback
						set((s) => {
							s.data.events.data = prev;
						});
						throw err;
					}
				},

				createPage: async (p) => {
					const created = await Api.createPage(p);
					set((s) => {
						s.data.pages.data.push(created);
					});
					return created;
				},

				updatePage: async (p) => {
					const upd = await Api.updatePage(p);
					set((s) => {
						s.data.pages.data = s.data.pages.data.map((x) =>
							x._id === (upd._id ?? upd.id) ? upd : x
						);
					});
					// Reload events to reflect any propagated sync from linked pages
					try {
						await get().loadEvents();
					} catch {}
					return upd;
				},

				deletePage: async (id) => {
					await Api.deletePage(id);
					set((s) => {
						s.data.pages.data = s.data.pages.data.filter(
							(x) => x._id !== id
						);
					});
				},
				getPage: async (id) => {
					const page = await Api.getPage(id);
					set((s) => {
						s.data.pages.data = s.data.pages.data.filter(
							(x) => x._id !== id
						);
					});
					return page;
				},
				replacePageInCache: (p) => {
					set((s) => {
						const idx = s.data.pages.data.findIndex(
							(x) => x._id === p._id
						);
						if (idx >= 0) s.data.pages.data[idx] = p;
						else s.data.pages.data.push(p);
					});
				},
			})),
			{
				name: 'dndlore-state',
				version: 4,
				migrate: (state: any, version) => {
				// Ensure root objects exist
				if (!state) return state as any;
				if (!state.ui)
					state.ui = { showHidden: false, activeGroupIds: [] };
				if (!state.data) {
					state.data = {
						groups: initialLoadable([]),
						events: initialLoadable([]),
						pages: initialLoadable([]),
						timeSystem: initialLoadable(null),
						assets: initialLoadable([]),
						assetFolders: initialLoadable([]),
					};
					return state as any;
				}

				// Sanitize group filter
				if (state.ui && Array.isArray(state.ui.activeGroupIds)) {
					state.ui.activeGroupIds =
						state.ui.activeGroupIds.filter(
							(x: any) => typeof x === 'string' && !!x
						);
				}

				// Reset group filters on migrate to honor new default-selection logic
				if (version < 4 && state.ui) {
					state.ui.activeGroupIds = [];
				}

				// Ensure assets slice exists after rehydrate from older versions
				if (!state.data.assets)
					state.data.assets = initialLoadable([]);
				if (!state.data.assetFolders)
					state.data.assetFolders = initialLoadable([]);					return state as any;
				},
			}
		)
	)
);
