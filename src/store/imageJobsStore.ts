import { create } from 'zustand';
import Api from '../Api';
import { useAppStore, type Asset } from './appStore';
import { imageOperationError, type ImageJob, type ImageRequest } from '../imageGeneration';

type State = {
  jobs: ImageJob[];
  configured: boolean | null;
  model: string;
  configurationError: string | null;
  error: string | null;
  refresh: () => Promise<void>;
  submit: (request: ImageRequest) => Promise<ImageJob>;
  reset: () => void;
};
let refreshPending: Promise<void> | null = null;
let revision = 0;
let assetsNeedRefresh = false;
export function updateImageAsset(asset: Asset) {
  useAppStore.setState(state => ({ data: { ...state.data, assets: { ...state.data.assets,
    data: [asset, ...state.data.assets.data.filter(item => item._id !== asset._id)] } } }));
}
export const useImageJobsStore = create<State>((set, get) => ({
  jobs: [], configured: null, model: '', configurationError: null, error: null,
  reset: () => { revision++; assetsNeedRefresh = false; set({ jobs: [], configured: null, model: '', configurationError: null, error: null }); },
  refresh: () => {
    if (refreshPending) return refreshPending;
    const version = revision;
    refreshPending = (async () => {
      try {
        const response = await Api.getImageJobs();
        if (version !== revision) return;
        const previous = get().jobs;
        set({ ...response, error: null });
        if (response.jobs.some(job => job.status === 'ready' && !previous.some(old => old._id === job._id && old.status === 'ready'))) {
          assetsNeedRefresh = true;
        }
        if (assetsNeedRefresh) {
          await useAppStore.getState().loadAssets();
          assetsNeedRefresh = !!useAppStore.getState().data.assets.error;
        }
      } catch (error) {
        if (version === revision) set({ error: imageOperationError(error) });
      } finally { refreshPending = null; }
    })();
    return refreshPending;
  },
  submit: async request => {
    const job = await Api.createImageJob(request);
    revision++;
    set(state => ({ jobs: [job, ...state.jobs.filter(item => item._id !== job._id)], error: null }));
    return job;
  },
}));
