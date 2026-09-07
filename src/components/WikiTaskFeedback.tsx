import React from "react";

export type RejectedWikiProposal = { slug: string | null; code: string; reason: string };

export default function WikiTaskFeedback({ error, report, rejected, reviewCount = 0 }: {
  error: string;
  report: string;
  rejected: RejectedWikiProposal[];
  reviewCount?: number;
}) {
  return <>
    {error && <p className="dm-settings__error" role="alert">{error}</p>}
    {(report || rejected.length > 0) && <p className="dm-settings__status" role="status">
      {reviewCount ? `${reviewCount} proposal${reviewCount === 1 ? "" : "s"} ready for review.` : "No proposals ready for review."} No page changes have been applied.
    </p>}
    {rejected.length > 0 && <div className="dm-settings__rejections">
      <h3 className="dm-settings__label">{rejected.length} proposal{rejected.length === 1 ? "" : "s"} excluded from review</h3>
      <ul>{rejected.map((proposal, index) => <li key={`${proposal.slug}-${index}`}>
        <span className="dm-settings__rejection-slug">{proposal.slug || "Unnamed proposal"}</span>: {proposal.reason}
      </li>)}</ul>
    </div>}
    {report && <pre className="dm-settings__output">{report}</pre>}
  </>;
}
