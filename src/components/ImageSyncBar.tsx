import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useImageJobsStore } from '../store/imageJobsStore';
import { isImagePending } from '../imageGeneration';
import GlobalProgressBar from './GlobalProgressBar';
import AssetsManagerModal from './AssetsManagerModal';
import '../styles/ImageStudio.scss';

export default function ImageSyncBar() {
  const isDM = useAppStore(state => state.isDM());
  const assets = useAppStore(state => state.data.assets.data);
  const { jobs, refresh, reset, error } = useImageJobsStore();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    if (!isDM) { reset(); setOpen(false); return; }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await refresh();
      if (!stopped) timer = setTimeout(poll, useImageJobsStore.getState().jobs.some(isImagePending) ? 3000 : 15000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [isDM, refresh, reset]);
  const active = jobs.filter(isImagePending);
  const drafts = assets.filter(asset => asset.reviewStatus === 'draft');
  const failures = jobs.filter(job => job.status === 'failed' && !dismissed.includes(job._id));
  if (!isDM) return null;
  return <>
    {!!(active.length || drafts.length || failures.length) && <GlobalProgressBar busy={active.length > 0}>
      <div className="lr-sync-bar__label" role="status">
        <span className="lr-sync-bar__caption">Images</span>
        <span className="lr-sync-bar__stats">{error ? 'Status unavailable — reconnecting…' : `${active.length} working · ${drafts.length} to review${failures.length ? ` · ${failures.length} failed` : ''}`}</span>
      </div>
      <button type="button" className="image-progress__review" onClick={() => setOpen(true)}>Review →</button>
      {!active.length && !drafts.length && <button type="button" className="lr-sync-bar__dismiss" aria-label="Dismiss image errors" onClick={() => setDismissed(jobs.filter(job => job.status === 'failed').map(job => job._id))}>×</button>}
    </GlobalProgressBar>}
    {open && <AssetsManagerModal isOpen onClose={() => setOpen(false)} initialTab={!active.length && drafts.length ? 'drafts' : 'generate'} />}
  </>;
}
