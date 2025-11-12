import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import RichTextBlock from '../components/richtext/RichTextBlock';
import { useAutoSave } from '../hooks/useAutoSave';
import { Page } from '../types';
import '../styles/LoreDetail.scss';
import { useAppStore } from '../store/appStore';
import {
	Calendar,
	CalendarBlank,
	CalendarCheck,
	Image,
	TrashSimple,
	CheckCircle,
	XCircle,
} from 'phosphor-react';
import AssetsManagerModal from '../components/AssetsManagerModal';
import Modal from 'react-modal';
import Api from '../Api';
import Divider from '../components/Divider';
import DatePicker from '../components/DatePicker';
import SessionDatePicker from '../components/SessionDatePicker';
import useAutoSizeTextArea from '../hooks/useAutoSizeTextArea';

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
	const loadTimeSystem = useAppStore((s) => s.loadTimeSystem);
	const timeSystem = useAppStore((s) => s.data.timeSystem.data);
	const groups = useAppStore((s) => s.data.groups.data);
	const loadGroups = useAppStore((s) => s.loadGroups);
	const createEvent = useAppStore((s) => s.createEvent);
	const updateEvent = useAppStore((s) => s.updateEvent);

	const [assetOpen, setAssetOpen] = useState(false);

	// --- Background blur on scroll -------------------------------------------
	const overflowRef = useRef<HTMLDivElement | null>(null);
	const [bgBlur, setBgBlur] = useState(0);
	const [bgGray, setBgGray] = useState(0);
	const rafId = useRef<number | null>(null);

	const titleRef = useRef<HTMLTextAreaElement>(null);
	const subtitleRef = useRef<HTMLTextAreaElement>(null);

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
				sessionDate: '',
				worldDate: null as any,
			} as any)
	);

	useAutoSizeTextArea('title-input', titleRef.current, pageDraft.title || '');
	useAutoSizeTextArea(
		'subtitle-input',
		subtitleRef.current,
		pageDraft.subtitle || ''
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

	// Ensure time system/groups are available when editing campaign pages
	useEffect(() => {
		if (type === 'campaign') {
			if (!timeSystem) void loadTimeSystem();
			if (!groups || groups.length === 0) void loadGroups();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [type]);

	// --- Save (create / update) ---------------------------------------------
	const saveFn = useCallback(
		async (data: Page) => {
			const title = (data.title ?? '').trim();
			if (!title) return; // don't create/update until there is a title

			const payload: any = {
				title,
				subtitle: (data as any).subtitle,
				bannerUrl: (data as any).bannerUrl,
				assetId: (data as any).assetId,
				bannerThumbUrl: (data as any).bannerThumbUrl,
				blocks: (data as any).blocks,
				hidden: (data as any).hidden,
				draft: (data as any).draft,
				sessionDate: (data as any).sessionDate,
				worldDate: (data as any).worldDate,
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

	const ordinal = (n: number) => {
		const mod100 = n % 100;
		if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
		switch (n % 10) {
			case 1:
				return `${n}st`;
			case 2:
				return `${n}nd`;
			case 3:
				return `${n}rd`;
			default:
				return `${n}th`;
		}
	};

	const formatWorldDate = (
		ts: any,
		wd: { eraId: string; year: number; monthIndex: number; day: number }
	) => {
		const era = ts?.eras?.find((e: any) => e.id === wd.eraId);
		const eraAbbr = era?.abbreviation || '';
		const monthName = ts?.months?.[wd.monthIndex]?.name;
		if (typeof wd.day === 'number' && monthName) {
			return `${ordinal(wd.day)} ${monthName} ${String(wd.year)}${
				eraAbbr ? `, ${eraAbbr}` : ''
			}`;
		}
		if (monthName) {
			return `${monthName} ${String(wd.year)}${
				eraAbbr ? `, ${eraAbbr}` : ''
			}`;
		}
		return `${String(wd.year)}${eraAbbr ? `, ${eraAbbr}` : ''}`;
	};

	// --- Publish/Unpublish ---------------------------------------------------
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

			// If campaign page with world date, check for existing event or create a linked timeline event
			if (type === 'campaign' && (pageDraft as any)?.worldDate) {
				const wd = (pageDraft as any).worldDate as {
					eraId: string;
					year: number;
					monthIndex: number;
					day: number;
				};
				const pageId = (upd as any)?._id || (pageDraft as any)?._id;
				
				// Check if an event already exists for this page
				try {
					const eventsResp = await Api.getEvents();
					const existingEvent = eventsResp.find((e: any) => e.pageId === pageId);
					
					if (existingEvent) {
						// Event exists, just unhide it
						await updateEvent({
							_id: existingEvent._id,
							hidden: false,
						});
						toast.success('Page published and event revealed');
						return;
					}
				} catch (err) {
					console.error('Failed to check for existing event', err);
				}
				
				// No existing event, create a new one
				// pick a group: prefer "Campaign" or similar, fallback to first
				let groupId =
					groups && groups.length ? groups[0]._id : undefined;
				const preferred = groups?.find((g: any) =>
					/campaign|session/i.test(g.name)
				);
				if (preferred) groupId = preferred._id;

				if (!groupId) {
					toast((t) => (
						<div>
							Published. No groups available to create a timeline
							event.
						</div>
					));
					toast.success('Page published');
					return;
				}

				const startDateStr = timeSystem
					? formatWorldDate(timeSystem, wd)
					: String(wd.year);

				try {
					await createEvent({
						title: (pageDraft as any).title || 'Session',
						groupId,
						startDate: startDateStr,
						startEraId: wd.eraId,
						startYear: wd.year,
						startMonthIndex: wd.monthIndex,
						startDay: wd.day,
						detailLevel: 'Day' as any,
						description: (pageDraft as any).subtitle || '',
						// @ts-ignore extended interface for page linkage
						pageId: pageId,
					} as any);
					toast.success('Page published and event created');
				} catch (err) {
					console.error('Failed to create event for page', err);
					toast.success('Page published (event not created)');
				}
			} else {
				toast.success('Page published');
			}
		} catch (e: any) {
			console.error('Failed to publish page', e);
			toast.error('Failed to publish page');
		}
	};

	const unpublishPage = async () => {
		try {
			const upd = await updatePage({
				_id: (pageDraft as any)._id,
				draft: true,
			});
			// update local state immediately
			setPageDraft((prev: any) => ({ ...prev, draft: true }));
			// ensure cache reflects latest
			if (upd) replacePageInCache(upd as any);
			toast.success('Page unpublished (linked events hidden)');
		} catch (e: any) {
			console.error('Failed to unpublish page', e);
			toast.error('Failed to unpublish page');
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
			
			{/* Fixed publish/unpublish button top-right */}
			{isDM && (
				<button
					className="icon_square-btn publish-toggle-btn"
					onClick={(pageDraft as any)?.draft ? publishPage : unpublishPage}
					title={(pageDraft as any)?.draft ? 'Publish' : 'Unpublish'}
					style={{ opacity: 0.6 }}
				>
					{(pageDraft as any)?.draft ? <CheckCircle size={24} weight="bold" /> : <XCircle size={24} weight="bold" />}
				</button>
			)}
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
									id="title-input"
								/>
							</>
						) : (
							<h1>{(pageDraft as any).title || 'New Title'}</h1>
						)}
					</h1>
					<div className="campaignWorldDate">
						<DatePicker
							ts={timeSystem}
							format="yearMonthDay"
							positionAbove={true}
							value={
								(pageDraft as any).worldDate
									? {
											eraId: (pageDraft as any).worldDate
												.eraId,
											year: String(
												(pageDraft as any).worldDate
													.year ?? ''
											),
											monthIndex: String(
												(pageDraft as any).worldDate
													.monthIndex ?? '0'
											),
											day: String(
												(pageDraft as any).worldDate
													.day ?? '1'
											),
									  }
									: null
							}
							onChange={(parts) => {
								setPageDraft((prev: any) => ({
									...prev,
									worldDate: parts
										? {
												eraId: parts.eraId,
												year:
													parseInt(
														parts.year || '0',
														10
													) || 0,
												monthIndex:
													parseInt(
														parts.monthIndex || '0',
														10
													) || 0,
												day:
													parseInt(
														parts.day || '1',
														10
													) || 1,
										  }
										: null,
								}));
							}}
						/>
					</div>
					<Divider />
					<h4 className="pageSubtitle">
						{isDM ? (
							<textarea
								className="richTextBlock richTextBlock--subtitle"
								key="page-title"
								value={(pageDraft as any).subtitle}
								placeholder="Subtitle"
								onChange={(e) => updateSubtitle(e.target.value)}
								id='subtitle-input'
							/>
						) : pageDraft.subtitle ? (
							<h4>{(pageDraft as any).subtitle || ''}</h4>
						) : null}
					</h4>
					{type === 'campaign' && (pageDraft.sessionDate || isDM) && (
						<div className="dateWrapper">
							{isDM ? (
								<SessionDatePicker
									value={
										(pageDraft as any).sessionDate || null
									}
									onChange={(dateStr) =>
										setPageDraft((prev: any) => ({
											...prev,
											sessionDate: dateStr || '',
										}))
									}
									placeholder="Select session date"
								/>
							) : (
								<span className="sessionDate">
									{pageDraft.sessionDate
										? pageDraft.sessionDate
										: 'N/A'}
								</span>
							)}
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

				{/* Campaign-only metadata fields */}
				{isDM && type === 'campaign' && (
					<div
						className="metaFields"
						style={{ margin: '8px 0 16px' }}
					>
						<Divider />
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
					</div>
				)}
			</div>
			<AssetsManagerModal
				isOpen={assetOpen}
				onClose={() => setAssetOpen(false)}
				onSelect={(asset) => {
					setPageDraft((prev) => ({
						...prev,
						bannerUrl: asset.url,
						bannerThumbUrl: asset.thumb_url,
						assetId: asset._id,
					}));
					setAssetOpen(false);
				}}
			/>
		</div>
	);
};

export default LoreDetail;
