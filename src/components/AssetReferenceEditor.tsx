import React, { useState } from 'react';
import Api from '../Api';
import type { Asset } from '../store/appStore';
import { updateImageAsset } from '../store/imageJobsStore';
import { imageOperationError, isApprovedAsset } from '../imageGeneration';

export default function AssetReferenceEditor({ asset }: { asset: Asset }) {
  const [kind, setKind] = useState(asset.reference?.kind || 'character');
  const [label, setLabel] = useState(asset.reference?.label || '');
  const [wikiSlug, setWikiSlug] = useState(asset.reference?.wikiSlug || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  if (!isApprovedAsset(asset)) return null;
  if (!asset.url.startsWith('/uploads/')) return <p className="image-studio__muted">Upload this image to pin it as a reference.</p>;
  const save = async (unpin = false) => {
    setBusy(true); setError(''); setSaved('');
    try {
      updateImageAsset(await Api.pinImageReference(asset._id, unpin ? null : { kind, label, wikiSlug }));
      setSaved(unpin ? 'Reference unpinned.' : 'Reference pinned. Select it in Generate & review.');
    } catch (err) { setError(imageOperationError(err)); }
    finally { setBusy(false); }
  };
  return <section className="image-studio image-studio__pin">
    <h3>Pin a reference</h3>
    <label>Role<select value={kind} onChange={event => setKind(event.target.value as typeof kind)}>
      <option value="character">Character identity</option><option value="style">Visual style</option>
    </select></label>
    <label>Reference name<input maxLength={120} value={label} onChange={event => setLabel(event.target.value)} placeholder="Elarielle / painted fantasy" /></label>
    <label>Wiki slug (optional)<input maxLength={120} value={wikiSlug} onChange={event => setWikiSlug(event.target.value)} placeholder="elarielle" /></label>
    <div className="image-studio__actions">
      <button type="button" disabled={busy || !label.trim()} onClick={() => void save()}>Save pin</button>
      {asset.reference?.kind && <button type="button" disabled={busy} onClick={() => void save(true)}>Unpin</button>}
    </div>
    {error && <p role="alert" className="image-studio__error">{error}</p>}
    {saved && <p role="status" className="image-studio__muted">{saved}</p>}
  </section>;
}
