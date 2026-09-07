import React from 'react';
import '../styles/LightRagSyncBar.scss';

export default function GlobalProgressBar({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return <div className="lr-sync-bar">
    <div className="lr-sync-bar__track">
      {busy && <div className="lr-sync-bar__fill lr-sync-bar__fill--animated" />}
    </div>
    {children}
  </div>;
}
