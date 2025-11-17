import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import '../styles/LoreHome.scss';
import LoreCreateFab from '../components/LoreCreateFab';
import PlaceMapView from '../components/PlaceMapView';
import { PlacePage } from '../components/InteractiveMapCanvas';
import Api from '../Api';
import { Page } from '../types';
import {
	CaretLeft,
	CaretRight,
	FileDotted,
	Trash,
	DotsSixVertical,
} from 'phosphor-react';
import { useAppStore } from '../store/appStore';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'react-hot-toast';
import CategoriesMenu from '../components/CategoriesMenu';
import Constants from '../Constants';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	DragEndEvent,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Sortable page item component for drag-and-drop
 */
interface SortablePageItemProps {
	page: Page;
	selectedCategory: string;
	isDM: boolean;
	onDeleteClick: (e: React.MouseEvent, page: Page) => void;
	onNavigate: () => void;
}

const SortablePageItem: React.FC<SortablePageItemProps> = ({
	page,
	selectedCategory,
	isDM,
	onDeleteClick,
	onNavigate,
}) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: page._id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<li
			ref={setNodeRef}
			style={style}
			className="pageListItem"
			onClick={onNavigate}
		>
			<div className="pageCard">
				{/* Drag handle - only this is draggable */}
				<span
					className="dragHandle"
					{...attributes}
					{...listeners}
					onClick={(e) => e.stopPropagation()}
					title="Drag to reorder"
				>
					<DotsSixVertical size={20} weight="bold" />
				</span>

				{page.bannerUrl && (
					<div
						className="thumb"
						style={{
							backgroundImage: `url(${Api.resolveThumbnailUrl(
								page.bannerUrl,
								page.bannerThumbUrl
							)})`,
						}}
					/>
				)}
				<div className="meta">
					<h3 className="pageTitle">{page.title}</h3>
					{page.subtitle && (
						<h4 className="pageSubtitle">
							{page.subtitle.toUpperCase()}
						</h4>
					)}

					{isDM && (
						<button
							className="deleteBtn"
							onClick={(e) => onDeleteClick(e, page)}
							title="Delete page"
						>
							<Trash size={18} weight="bold" />
						</button>
					)}
				</div>
				{page.draft && isDM && (
					<span className="draftBadge">
						<FileDotted size={18} />
					</span>
				)}
			</div>
		</li>
	);
};

/**
 * Landing page for the lore library with a two-column layout.
 * Left column shows the different categories of lore pages.
 * Right column displays the list of pages for the selected category.
 */
const LoreHome: React.FC = () => {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();

	// Define the categories available. We include a user‑friendly label
	// and the corresponding type used in the API. A placeholder icon can
	// be replaced with images if desired.
	const categories = [
		{ type: 'campaign', label: 'Campaign' },
		{ type: 'place', label: 'Places' },
		{ type: 'history', label: 'History' },
		{ type: 'myth', label: 'Myths' },
		{ type: 'people', label: 'People' },
	];

	/**
	 * Generate an excerpt from a page block's plainText.
	 * Truncates at the last complete word within 400 characters.
	 */
	const generateExcerpt = (text: string, maxLength: number = 400): string => {
		if (!text || text.length <= maxLength) {
			return text;
		}

		// Find the last space within the maxLength limit
		const truncated = text.substring(0, maxLength);
		const lastSpaceIndex = truncated.lastIndexOf(' ');

		// If we found a space, cut there; otherwise use the full maxLength
		const excerpt =
			lastSpaceIndex > 0
				? truncated.substring(0, lastSpaceIndex)
				: truncated;

		return excerpt + '<span class="moreIndicator"> ...MORE</span>';
	};

	// Get category from URL query params, default to first category
	const categoryFromUrl = searchParams.get('category');
	const initialCategory =
		categories.find((c) => c.type === categoryFromUrl)?.type ||
		categories[0].type;

	const [selectedCategory, setSelectedCategory] =
		useState<string>(initialCategory);
	// Zustand store selectors
	const loadPages = useAppStore((s) => s.loadPages);
	const pagesFromStore = useAppStore((s) => s.data.pages.data);
	const storeLoading = useAppStore((s) => s.data.pages.loading);
	const isDM = useAppStore((s) => s.isDM());
	const deletePage = useAppStore((s) => s.deletePage);
	const createPage = useAppStore((s) => s.createPage);
	const updatePage = useAppStore((s) => s.updatePage);

	// Delete confirmation modal state
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [pageToDelete, setPageToDelete] = useState<Page | null>(null);

	// Left menu collapse state
	const [leftMenuCollapsed, setLeftMenuCollapsed] = useState(false);

	// Drag-and-drop sensors
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	// Sorted and filtered pages with default sorting
	const sortedPages = useMemo(() => {
		const filtered = (pagesFromStore || [])
			.filter((p) => p.type === (selectedCategory as any))
			.filter((p) => (isDM ? true : !p.draft));

		// Sort by order field first (if set), then apply category-specific default sorting
		return [...filtered].sort((a, b) => {
			// If both have order fields, use them
			const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
			const orderB = b.order ?? Number.MAX_SAFE_INTEGER;

			if (orderA !== orderB) {
				return orderA - orderB;
			}

			// If order is the same (or both unset), apply category-specific sorting
			if (selectedCategory === 'campaign') {
				// Campaign pages: sort by sessionDate descending (newest first)
				const parseDate = (dateStr?: string) => {
					if (!dateStr) return 0;
					const [day, month, year] = dateStr.split('/').map(Number);
					return new Date(year, month - 1, day).getTime();
				};
				const dateA = parseDate(a.sessionDate);
				const dateB = parseDate(b.sessionDate);
				return dateB - dateA; // descending
			} else if (selectedCategory === 'history') {
				// History pages: sort by worldDate ascending (oldest first)
				const getWorldYear = (p: Page) => {
					if (!p.worldDate) return 0;
					return p.worldDate.year;
				};
				const yearA = getWorldYear(a);
				const yearB = getWorldYear(b);
				return yearA - yearB; // ascending
			}

			// For other categories, maintain insertion order
			return 0;
		});
	}, [pagesFromStore, selectedCategory, isDM]);

	// Local state for drag-and-drop reordering
	const [localPageOrder, setLocalPageOrder] = useState<string[]>([]);

	// Update local order when sorted pages change
	useEffect(() => {
		setLocalPageOrder(sortedPages.map((p) => p._id));
	}, [sortedPages]);

	// Get pages in current display order
	const displayPages = useMemo(() => {
		return localPageOrder
			.map((id) => sortedPages.find((p) => p._id === id))
			.filter((p): p is Page => p !== undefined);
	}, [localPageOrder, sortedPages]);

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			const oldIndex = localPageOrder.indexOf(active.id as string);
			const newIndex = localPageOrder.indexOf(over.id as string);
			const newOrder = arrayMove(localPageOrder, oldIndex, newIndex);

			setLocalPageOrder(newOrder);

			// Persist order to backend
			try {
				await Api.reorderPages(selectedCategory, newOrder);
				toast.success('Page order updated');
			} catch (error) {
				console.error('Failed to update page order:', error);
				toast.error('Failed to save page order');
				// Revert to previous order on error
				setLocalPageOrder(localPageOrder);
			}
		}
	};

	const handleDeleteClick = (e: React.MouseEvent, page: Page) => {
		e.stopPropagation(); // Prevent navigation to page detail
		setPageToDelete(page);
		setDeleteModalOpen(true);
	};

	const confirmDelete = async () => {
		if (!pageToDelete) return;
		try {
			await deletePage(pageToDelete._id);
			toast.success('Page deleted successfully');
			setDeleteModalOpen(false);
			setPageToDelete(null);
			// Reload pages to update the list
			loadPages(selectedCategory as any);
		} catch (error) {
			console.error('Failed to delete page:', error);
			toast.error('Failed to delete page');
		}
	};

	const cancelDelete = () => {
		setDeleteModalOpen(false);
		setPageToDelete(null);
	};

	// Background blur on scroll
	const overflowRef = useRef<HTMLDivElement | null>(null);
	const [bgBlur, setBgBlur] = useState(0);
	const [bgGray, setBgGray] = useState(0);
	const rafId = useRef<number | null>(null);

	const handleScroll = () => {
		const el = overflowRef.current;
		if (!el) return;
		const scrollTop = el.scrollTop;
		const MAX_BLUR = 12;
		const THRESHOLD = 1200;
		const ratio = Math.min(1, scrollTop / THRESHOLD);
		const nextBlur = MAX_BLUR * ratio;
		if (rafId.current) cancelAnimationFrame(rafId.current);
		rafId.current = requestAnimationFrame(() => {
			setBgBlur(nextBlur);
			setBgGray(ratio);
		});
	};

	useEffect(
		() => () => {
			if (rafId.current) cancelAnimationFrame(rafId.current);
		},
		[]
	);

	// Update URL when category changes
	const handleCategoryChange = (categoryType: string) => {
		setSelectedCategory(categoryType);
		setSearchParams({ category: categoryType });
	};

	// Sync state with URL on mount and when URL changes
	useEffect(() => {
		const urlCategory = searchParams.get('category');
		if (urlCategory && categories.find((c) => c.type === urlCategory)) {
			setSelectedCategory(urlCategory);
		}
	}, [searchParams]);

	useEffect(() => {
		if (!selectedCategory) return;
		// Ask store to load pages of this type
		loadPages(selectedCategory as any);
	}, [selectedCategory, loadPages]);

	return (
		<div
			className="loreHome offset-container"
			style={{
				background:
					selectedCategory !== 'place'
						? `url(${Constants.LORE_BG[selectedCategory]})`
						: 'none',
			}}
		>
			{/* Left Categories Menu - Always visible */}
			<CategoriesMenu
				categories={categories}
				selectedCategory={selectedCategory}
				onCategoryChange={handleCategoryChange}
			/>
			{selectedCategory === 'place' ? (
				<PlaceMapView
					imageUrl={require('../assets/Aetherium-Tyriandor.webp')}
					onPlaceClick={(place) =>
						navigate(`/lore/place/${place._id}`)
					}
					leftMenuCollapsed={leftMenuCollapsed}
				/>
			) : (
				<div
					className="bgLayer"
					style={{
						filter: `blur(${bgBlur}px) grayscale(${bgGray})`,
					}}
				/>
			)}
			<div className="overlay"></div>

			{/* Hide overflow container when viewing places category */}
			{selectedCategory !== 'place' && (
				<div
					className="overflow-container"
					ref={overflowRef}
					onScroll={handleScroll}
				>
					<div className="contentContainer">
						<h1 className="loreTitle">
							The Great Library of Morne
						</h1>
						<p className="loreSubtitle">
							Welcome to the Great Library of Morne! Explore the
							world of Aetherium through its places, history and
							myths.
						</p>

						<div className="loreColumns">
							{/* Pages list */}

							<div
								className="pagesColumn"
								style={{ flex: '1', maxWidth: '100%' }}
							>
								{storeLoading ? (
									<p className="loadingText">Loading…</p>
								) : isDM ? (
									// DM users: enable drag-and-drop reordering
									<DndContext
										sensors={sensors}
										collisionDetection={closestCenter}
										onDragEnd={handleDragEnd}
									>
										<SortableContext
											items={localPageOrder}
											strategy={
												verticalListSortingStrategy
											}
										>
											<ul className="pageList">
												{displayPages.map((page) => (
													<SortablePageItem
														key={page._id}
														page={page}
														selectedCategory={
															selectedCategory
														}
														isDM={isDM}
														onDeleteClick={
															handleDeleteClick
														}
														onNavigate={() =>
															navigate(
																`/lore/${selectedCategory}/${page._id}`
															)
														}
													/>
												))}
												{displayPages.length === 0 && (
													<p className="emptyText">
														No pages found.
													</p>
												)}
											</ul>
										</SortableContext>
									</DndContext>
								) : (
									// Non-DM users: simple list without drag-and-drop
									<ul className="pageList">
										{displayPages.map((page) => (
											<li
												key={page._id}
												className="pageListItem"
												onClick={() =>
													navigate(
														`/lore/${selectedCategory}/${page._id}`
													)
												}
											>
												<div className="pageCard">
													{page.bannerUrl && (
														<div
															className="thumb"
															style={{
																backgroundImage: `url(${Api.resolveThumbnailUrl(
																	page.bannerUrl,
																	page.bannerThumbUrl
																)})`,
															}}
														/>
													)}
													<div className="meta">
														<h3 className="pageTitle">
															{page.title}
														</h3>
														{page.subtitle && (
															<h4 className="pageSubtitle">
																{page.subtitle.toUpperCase()}
															</h4>
														)}
													</div>
													{page.draft && isDM && (
														<span className="draftBadge">
															<FileDotted
																size={18}
															/>
														</span>
													)}
												</div>
											</li>
										))}
										{displayPages.length === 0 && (
											<p className="emptyText">
												No pages found.
											</p>
										)}
									</ul>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
			{isDM && selectedCategory !== 'place' && <LoreCreateFab />}

			<ConfirmModal
				isOpen={deleteModalOpen}
				title="Delete Page"
				message={`Are you sure you want to delete "${
					pageToDelete?.title || ''
				}"?`}
				confirmText="Delete"
				variant="danger"
				onConfirm={confirmDelete}
				onCancel={cancelDelete}
			/>
		</div>
	);
};

export default LoreHome;
