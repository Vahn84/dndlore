import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import RichTextBlock from '../components/richtext/RichTextBlock';
import { useAutoSave } from '../hooks/useAutoSave';
import { Page } from '../types';
import '../styles/LoreDetail.scss';
import { useAppStore } from '../store/appStore';
import { Image, TrashSimple } from 'phosphor-react';
import AssetsManagerModal from '../components/AssetsManagerModal';
import Modal from 'react-modal';
import Api from '../Api';
import Divider from '../components/Divider';

Modal.setAppElement('#root');

// Minimal TipTap doc (used by RichTextBlock as fallback when block.rich is undefined)
const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] } as const;

const LoreDetail: React.FC<{ isDM: boolean }> = ({ isDM }) => {
	const navigate = useNavigate();
	const { type, id } = useParams<{ type: string; id?: string }>();
	const creatingRef = useRef(false);

	const createPage = useAppStore((s) => s.createPage);
	const updatePage = useAppStore((s) => s.updatePage);
	const getPage = useAppStore((s) => s.getPage);
	const replacePageInCache = useAppStore((s) => s.replacePageInCache);

	const [assetOpen, setAssetOpen] = useState(false);

	// --- Background blur on scroll -------------------------------------------
	const overflowRef = useRef<HTMLDivElement | null>(null);
	const [bgBlur, setBgBlur] = useState(0);
	const [bgGray, setBgGray] = useState(0);
	const rafId = useRef<number | null>(null);

	const handleScroll = () => {
		const el = overflowRef.current;
		if (!el) return;
		const scrollTop = el.scrollTop;
		const MAX_BLUR = 12;
		const THRESHOLD = 1200; // px to reach max
		const ratio = Math.min(1, scrollTop / THRESHOLD);
		const nextBlur = MAX_BLUR * ratio;
		if (rafId.current) cancelAnimationFrame(rafId.current);
		rafId.current = requestAnimationFrame(() => {
			setBgBlur(nextBlur);
			setBgGray(ratio); // 0..1 grayscale
		});
	};

	useEffect(
		() => () => {
			if (rafId.current) cancelAnimationFrame(rafId.current);
		},
		[]
	);

	// --- Helpers --------------------------------------------------------------
	const uid = () =>
		`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

	const makeRichBlock = () => ({
		id: uid(),
		type: 'rich' as const,
		hidden: false,
		// rich will be created by the editor; plainText keeps previews/search fast
		plainText: '',
	});

	// Normalize a block coming from children before storing into pageDraft
	const normalizeBlock = (b: any) => {
		if (!b) return makeRichBlock();
		if (b.type === 'image') {
			// keep minimal image shape if you use images later
			return {
				id: b.id || uid(),
				type: 'image',
				url: b.url,
				hidden: !!b.hidden,
			};
		}
		// rich block (default)
		return {
			id: b.id || uid(),
			type: 'rich' as const,
			hidden: !!b.hidden,
			rich: b.rich ?? emptyDoc,
			plainText: typeof b.plainText === 'string' ? b.plainText : '',
		};
	};

	// --- Local state ----------------------------------------------------------
	const [pageDraft, setPageDraft] = useState<Page>(
		() =>
			({
				// @ts-ignore store category/type if your API expects it
				type,
				title: '',
				bannerUrl: '',
				blocks: [makeRichBlock()],
				hidden: false,
				draft: true,
			} as any)
	);

	const [focusIndex, setFocusIndex] = useState<number | null>(null);
	const [isLoadingPage, setIsLoadingPage] = useState(false);

	// Focus handoff flag reset
	React.useEffect(() => {
		if (focusIndex === null) return;
		const t = setTimeout(() => setFocusIndex(null), 250);
		return () => clearTimeout(t);
	}, [focusIndex]);

	// Hydrate when editing an existing page -----------------------------------
	React.useEffect(() => {
		if (!id) return; // create mode
		let alive = true;
		(async () => {
			try {
				setIsLoadingPage(true);
				const p: any = await getPage(id);
				if (!alive) return;
				const blocks =
					Array.isArray(p?.blocks) && p.blocks.length > 0
						? p.blocks.map(normalizeBlock)
						: [makeRichBlock()];
				setPageDraft((prev: any) => ({
					...prev,
					...p,
					blocks,
				}));
			} finally {
				if (alive) setIsLoadingPage(false);
			}
		})();
		return () => {
			alive = false;
		};
	}, [id, getPage]);

	// --- Save (create / update) ---------------------------------------------
	const saveFn = useCallback(
		async (data: Page) => {
			const title = (data.title ?? '').trim();
			if (!title) return; // don't create/update until there is a title

			const payload: any = {
				title,
				subtitle: (data as any).subtitle,
				bannerUrl: (data as any).bannerUrl,
				blocks: (data as any).blocks,
				hidden: (data as any).hidden,
				draft: (data as any).draft,
				// @ts-ignore include type/category if your API expects it
				type,
			};

			if (id) {
				// UPDATE MODE
				try {
					await updatePage({ _id: id, ...payload });
				} catch (e) {
					// swallow to allow next autosave; toaster can be added here if needed
				}
				return;
			}

			// CREATE MODE (first save only)
			if (creatingRef.current) return;
			creatingRef.current = true;

			const tId = toast.loading('Saving…', { id: 'page-save' });
			try {
				const created = await createPage(payload);
				toast.success('Saved', { id: tId, duration: 1200 });
				if (created?._id)
					navigate(`/lore/${type}/${created._id}`, { replace: true });
			} catch (e: any) {
				creatingRef.current = false;
				toast.error(e?.message || 'Save failed', {
					id: tId,
					duration: 2500,
				});
				throw e;
			}
		},
		[id, type, createPage, updatePage, navigate]
	);

	const { isSaving, lastSavedAt, error } = useAutoSave(pageDraft, saveFn, {
		idleMs: 2500,
	});

	// --- Block operations -----------------------------------------------------
	const updateBlock = (idx: number, block: any) => {
		setPageDraft((prev: any) => {
			const next = { ...prev };
			const arr = Array.isArray(next.blocks) ? [...next.blocks] : [];
			arr[idx] = normalizeBlock(block);
			next.blocks = arr;
			return next;
		});
	};

	const moveBlock = (idx: number, dir: -1 | 1) => {
		setPageDraft((prev: any) => {
			const arr = Array.isArray(prev.blocks) ? [...prev.blocks] : [];
			const to = idx + dir;
			if (to < 0 || to >= arr.length) return prev; // out of bounds
			const [item] = arr.splice(idx, 1);
			arr.splice(to, 0, item);
			return { ...prev, blocks: arr };
		});
		setFocusIndex((v) => (v === idx ? idx + dir : v));
	};

	const removeBlock = (idx: number) => {
		setPageDraft((prev: any) => {
			const arr = Array.isArray(prev.blocks) ? [...prev.blocks] : [];
			arr.splice(idx, 1);
			return { ...prev, blocks: arr };
		});
	};

	const addBlockBelow = (i: number) => {
		setPageDraft((prev: any) => {
			const next = { ...prev };
			const arr = Array.isArray(next.blocks) ? [...next.blocks] : [];
			const insertAt = i + 1;
			arr.splice(insertAt, 0, makeRichBlock());
			next.blocks = arr;
			return next;
		});
		setFocusIndex(i + 1);
	};

	const updateTitle = (text: string) => {
		setPageDraft((prev: any) => ({ ...prev, title: text }));
	};

	const updateSubtitle = (text: string) => {
		setPageDraft((prev: any) => ({ ...prev, subtitle: text }));
	};

	// Remove banner image and persist immediately when possible
	const removeBanner = async () => {
		// Update UI instantly
		setPageDraft((prev: any) => ({ ...prev, bannerUrl: '' }));
		debugger;
		// If editing an existing page, persist right away
		if (id) {
			try {
				const upd = await updatePage({ _id: id, bannerUrl: '' });
				replacePageInCache(upd as any);
				toast.success('Banner removed');
			} catch (e: any) {
				console.error('Failed to remove banner', e);
				toast.error('Failed to remove banner');
			}
		}
	};

	// --- Publish (toggle draft off) -----------------------------------------
	const publishPage = async () => {
		try {
			const upd = await updatePage({
				_id: (pageDraft as any)._id,
				draft: false,
			});
			// update local state immediately
			setPageDraft((prev: any) => ({ ...prev, draft: false }));
			// ensure cache reflects latest
			if (upd) replacePageInCache(upd as any);
			toast.success('Page published');
		} catch (e: any) {
			console.error('Failed to publish page', e);
			toast.error('Failed to publish page');
		}
	};

	// --- Render ---------------------------------------------------------------
	return (
		<div
			className="loreDetail offset-container"
			style={{
				background: `url(${
					pageDraft.bannerUrl
						? Api.resolveAssetUrl(pageDraft.bannerUrl)
						: 'transparent'
				})`,
			}}
		>
			<div
				className="bgLayer"
				style={{ filter: `grayscale(${bgGray}) blur(${bgBlur}px)` }}
			/>
			<div className="overlay"></div>
			{isLoadingPage && (
				<div style={{ padding: 16, opacity: 0.7 }}>Loading…</div>
			)}
			<div
				className="overflow-container"
				ref={overflowRef}
				onScroll={handleScroll}
			>
				<div className="contentContainer">
					<h1 className="pageTitle">
						{isDM ? (
							<>
								{pageDraft.bannerUrl ? (
									<div
										className="banner-icon loaded"
										onClick={removeBanner}
									>
										<Image size={32} />
										<span>REMOVE BANNER</span>
									</div>
								) : (
									<div
										className="banner-icon loaded"
										onClick={() => setAssetOpen(true)}
									>
										<Image size={32} />
										<span>ADD BANNER</span>
									</div>
								)}
								<textarea
									className="richTextBlock richTextBlock--title"
									key="page-title"
									value={(pageDraft as any).title}
									placeholder="New Title"
									onChange={(e) =>
										updateTitle(e.target.value)
									}
								/>
							</>
						) : (
							<h1>{(pageDraft as any).title || 'New Title'}</h1>
						)}
					</h1>
					<Divider />
					<h4 className="pageSubtitle">
						{isDM ? (
							<textarea
								className="richTextBlock richTextBlock--subtitle"
								key="page-title"
								value={(pageDraft as any).subtitle}
								placeholder="Subtitle"
								onChange={(e) => updateSubtitle(e.target.value)}
							/>
						) : pageDraft.subtitle ? (
							<h4>{(pageDraft as any).subtitle || ''}</h4>
						) : null}
					</h4>
					<div className="saveStatus">
						{isSaving
							? 'Saving…'
							: lastSavedAt
							? `Last saved at: ${new Date(
									lastSavedAt
							  ).toLocaleTimeString()}`
							: null}
						{error ? (
							<span className="error"> • {error}</span>
						) : null}
					</div>

					{isDM && (pageDraft as any)?.draft && (
						<div className="publishRow">
							<button
								className="publishBtn"
								onClick={publishPage}
							>
								Publish
							</button>
						</div>
					)}

					<div className="blocks">
						{(pageDraft as any)?.blocks?.map(
							(b: any, i: number) => {
								if (!isDM && b.hidden) return null;
								if (b.type === 'image') {
									return (
										<div
											key={b.id || i}
											className={`imageBlock ${
												isDM && b.hidden
													? 'rt-hidden'
													: ''
											}`}
										>
											<img src={b.url} alt="" />
										</div>
									);
								}
								return (
									<RichTextBlock
										key={b.id || i}
										className="richTextBlock"
										value={{ ...b, type: 'rich' }}
										editable={isDM}
										floatingMenu={false}
										onChange={(next) =>
											updateBlock(i, next)
										}
										onMoveUp={
											isDM
												? () => moveBlock(i, -1)
												: undefined
										}
										onMoveDown={
											isDM
												? () => moveBlock(i, +1)
												: undefined
										}
										onDelete={
											isDM
												? () => removeBlock(i)
												: undefined
										}
										placeholder={
											isDM
												? 'Add your content here...'
												: ''
										}
										requestFocus={focusIndex === i}
										isDM={isDM}
										addBlock={() => addBlockBelow(i)}
										insertBlocksAfter={(blocks) => {
											setPageDraft((prev) => {
												const next = { ...prev };
												const arr = [
													...(next.blocks || []),
												];
												arr.splice(
													i + 1,
													0,
													...blocks.map((b) => ({
														id: `${Date.now()}-${Math.random()
															.toString(36)
															.slice(2, 6)}`,
														hidden: false,
														...b,
													}))
												);
												next.blocks = arr;
												return next;
											});
										}}
									/>
								);
							}
						)}
					</div>
				</div>
			</div>
			<AssetsManagerModal
				isOpen={assetOpen}
				onClose={() => setAssetOpen(false)}
				onSelect={(asset) => {
					setPageDraft((prev) => ({
						...prev,
						bannerUrl: asset.url,
					}));
					setAssetOpen(false);
				}}
			/>
		</div>
	);
};

export default LoreDetail;
