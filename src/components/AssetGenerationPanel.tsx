import React, { useRef, useState } from 'react';
import Api from '../Api';
import { useAppStore, type Asset } from '../store/appStore';
import { updateImageAsset, useImageJobsStore } from '../store/imageJobsStore';
import { createImageRequestId, imageOperationError, isApprovedAsset, isImagePending, type ImageContext, type ImageRequest } from '../imageGeneration';
import AssetReferenceEditor from './AssetReferenceEditor';

export default function AssetGenerationPanel({ context, folderId, onSelect }: {
  context?: ImageContext; folderId: string | null; onSelect?: (asset: Asset) => void;
}) {
  const assets = useAppStore(state => state.data.assets.data);
  const { jobs, configured, configurationError, error: statusError, submit, refresh } = useImageJobsStore();
  const [prompt, setPrompt] = useState('');
  const [campaignContext, setCampaignContext] = useState([context?.title, context?.text].filter(Boolean).join('\n\n').slice(0, 18000));
  const [format, setFormat] = useState<ImageRequest['format']>('landscape');
  const [referenceIds, setReferenceIds] = useState<string[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const requestIdentity = useRef<{ signature: string; id: string } | null>(null);
  const selectedJob = jobs.find(job => job._id === selectedJobId) || jobs[0];
  const draft = assets.find(asset => asset._id === selectedJob?.assetId);
  const references = assets.filter(asset => asset.url.startsWith('/uploads/') && asset.reviewStatus !== 'rejected' && (asset.reference?.kind || referenceIds.includes(asset._id)));
  const pending = jobs.filter(isImagePending).length;

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    const input = { prompt, context: campaignContext, format, referenceIds, folderId };
    const signature = JSON.stringify(input);
    // Reuse the identity after a lost HTTP response, avoiding duplicate Codex work.
    try {
      if (requestIdentity.current?.signature !== signature) requestIdentity.current = { signature, id: createImageRequestId() };
      const job = await submit({ ...input, requestId: requestIdentity.current.id });
      setSelectedJobId(job._id);
      requestIdentity.current = null;
      void refresh();
    } catch (err) { setError(`${imageOperationError(err)} Check recent jobs before trying again.`); }
    finally { submitting.current = false; setBusy(false); }
  };
  const review = async (status: 'approved' | 'rejected') => {
    if (!draft) return;
    setReviewBusy(true); setError('');
    try { updateImageAsset(await Api.reviewImageAsset(draft._id, status)); }
    catch (err) { setError(imageOperationError(err)); }
    finally { setReviewBusy(false); }
  };
  return <div className="image-studio image-studio__layout">
    <form className="image-studio__compose" onSubmit={generate}>
      <h3>Generate an illustration</h3>
      <p className="image-studio__muted">Codex · Built-in image generation on the Mac worker. Uses your Codex allowance; no API key or API fallback.</p>
      {configured === false && <p role="alert" className="image-studio__error">{configurationError || 'Codex image worker is unavailable. Check the Mac worker and wiki relay.'}</p>}
      <label>Scene<textarea rows={5} required maxLength={6000} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Describe the moment, characters, framing and mood…" /></label>
      <details open={!!context}>
        <summary>Campaign context · sent with the scene</summary>
        <p className="image-studio__muted">Prefilled from visible page text; hidden blocks are excluded. Review before generating.</p>
        <label>Recap or page text<textarea rows={5} maxLength={18000} value={campaignContext} onChange={event => setCampaignContext(event.target.value)} /></label>
      </details>
      <div className="image-studio__options">
        <label>Requested framing<select value={format} onChange={event => setFormat(event.target.value as ImageRequest['format'])}>
          <option value="landscape">Landscape · banner</option><option value="square">Square</option><option value="portrait">Portrait</option>
        </select></label>
      </div>
      <p className="image-studio__muted">Framing guides the prompt. Codex chooses the native image dimensions and quality.</p>
      <h3>References · {referenceIds.length}/8 selected</h3>
      <p className="image-studio__muted">Pin portraits and styles from the Library. Selected images are attached to the Codex run and sent to OpenAI; references improve consistency but cannot guarantee it.</p>
      <div className="image-studio__references">
        {references.map(asset => <button type="button" className="image-studio__reference" key={asset._id}
          aria-pressed={referenceIds.includes(asset._id)} disabled={referenceIds.length >= 8 && !referenceIds.includes(asset._id)}
          onClick={() => setReferenceIds(ids => ids.includes(asset._id) ? ids.filter(id => id !== asset._id) : [...ids, asset._id])}>
          <img src={Api.resolveAssetUrl(asset.thumb_url || asset.url)} alt="" />
          <span>{asset.reference?.label || asset.name || 'Variation reference'}<small>{asset.reference?.kind || 'visual'}{referenceIds.includes(asset._id) ? ' · selected' : ''}</small></span>
        </button>)}
      </div>
      {!references.length && <p className="image-studio__muted">No pinned references yet. You can still generate from the scene alone.</p>}
      {referenceIds.some(id => !references.some(asset => asset._id === id)) && <button type="button" onClick={() => setReferenceIds(ids => ids.filter(id => references.some(asset => asset._id === id)))}>Remove unavailable references</button>}
      <button type="submit" disabled={busy || configured !== true || !prompt.trim() || pending >= 4}>{busy ? 'Submitting…' : 'Generate 1 image'}</button>
      <p className="image-studio__muted">One image per request. You can close this window while it runs. No automatic regeneration.</p>
      {error && <p role="alert" className="image-studio__error">{error}</p>}
    </form>
    <section className="image-studio__review">
      <h3>Generation review</h3>
      {statusError && <p role="alert" className="image-studio__error">Status unavailable: {statusError} Jobs may still be running. <button type="button" onClick={() => void refresh()}>Refresh</button></p>}
      {!jobs.length && <p className="image-studio__muted">Your recent generations will appear here.</p>}
      {selectedJob && <>
        <p className="image-studio__status" role="status">{selectedJob.status === 'running' ? (selectedJob.workerMessage || 'Connecting to the Codex image worker…') : selectedJob.status === 'queued' ? 'Queued — waiting for the previous image.' : selectedJob.status === 'ready' ? `Image ${draft?.reviewStatus || 'ready'}` : 'Generation failed'}</p>
        {selectedJob.error && <p className="image-studio__error">{selectedJob.error}</p>}
        {draft && <>
          <img className="image-studio__preview" src={Api.resolveAssetUrl(draft.url)} alt={selectedJob.prompt} />
          <div className="image-studio__actions">
            {!isApprovedAsset(draft) && <button type="button" disabled={reviewBusy} onClick={() => void review('approved')}>Approve image</button>}
            {draft.reviewStatus === 'draft' && <button type="button" disabled={reviewBusy} onClick={() => void review('rejected')}>Reject</button>}
            {isApprovedAsset(draft) && onSelect && <button type="button" onClick={() => onSelect(draft)}>Use asset</button>}
            {draft.reviewStatus !== 'rejected' && <button type="button" onClick={() => {
              setPrompt(selectedJob.prompt); setCampaignContext(selectedJob.context);
              setReferenceIds([draft._id, ...selectedJob.references.map(ref => ref.assetId).filter(id => id !== draft._id)].slice(0, 8));
            }}>Use as variation reference</button>}
          </div>
          <AssetReferenceEditor key={draft._id} asset={draft} />
        </>}
        {selectedJob.status === 'ready' && !draft && <p className="image-studio__muted">Image is loading or has been removed from the library.</p>}
        <details><summary>Generation details</summary><p>{selectedJob.prompt}</p><p className="image-studio__muted">Codex image generation · {selectedJob.format}{selectedJob.agentModel ? ` · agent: ${selectedJob.agentModel}` : ''}</p></details>
      </>}
      <div className="image-studio__history" aria-label="Recent image jobs">
        {jobs.map(job => <button type="button" key={job._id} aria-pressed={job._id === selectedJob?._id} onClick={() => setSelectedJobId(job._id)}>
          <span>{job.prompt}</span><small>{job.status} · {new Date(job.createdAt).toLocaleString()}</small>
        </button>)}
      </div>
    </section>
  </div>;
}
