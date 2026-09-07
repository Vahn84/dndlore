export type ImageContext = { title: string; text: string };
export type ImageReference = { kind: 'character' | 'style'; label: string; wikiSlug?: string };
export type ImageRequest = {
  requestId: string;
  prompt: string;
  context: string;
  format: 'landscape' | 'square' | 'portrait';
  referenceIds: string[];
  folderId: string | null;
};
export type ImageJob = Omit<ImageRequest, 'referenceIds'> & {
  _id: string;
  model: string;
  agentModel?: string;
  workerMessage?: string;
  status: 'queued' | 'running' | 'ready' | 'failed';
  assetId?: string;
  error?: string;
  createdAt: string;
  references: { assetId: string; kind: string; label: string; wikiSlug?: string }[];
};
export type ImageJobsResponse = { configured: boolean; model: string; configurationError: string | null; jobs: ImageJob[] };
export const isImagePending = (job: ImageJob) => job.status === 'queued' || job.status === 'running';
export const isApprovedAsset = (asset: { reviewStatus?: string }) => !asset.reviewStatus || asset.reviewStatus === 'approved';

export function createImageRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // randomUUID is unavailable on an HTTP LAN origin in some browsers.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Extract visible prose, not arbitrary page metadata, URLs or asset IDs.
export function imageContextText(value: unknown): string {
  const collect = (node: unknown, depth = 0): string => {
    if (depth > 30 || node == null) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(part => collect(part, depth + 1)).filter(Boolean).join('\n');
    if (typeof node !== 'object') return '';
    const data = node as Record<string, unknown>;
    if (data.hidden === true) return '';
    if (typeof data.text === 'string') return data.text;
    return collect(data.content ?? data.rich ?? data.plainText ?? data.html ?? '', depth + 1);
  };
  return collect(value).replace(/<[^>]*>/g, '').slice(0, 18000);
}

export function imageOperationError(error: unknown): string {
  const candidate = error as { response?: { data?: { error?: string } }; message?: string };
  return candidate?.response?.data?.error || candidate?.message || 'Image operation failed.';
}
