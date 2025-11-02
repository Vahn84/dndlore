import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import '../styles/LoreHome.scss';
import LoreCreateFab from '../components/LoreCreateFab';
import Api from '../Api';
import { Page } from '../types';
import { FileDotted } from 'phosphor-react';
import { useAppStore } from '../store/appStore';

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
		{ type: 'place', label: 'Places' },
		{ type: 'history', label: 'History' },
		{ type: 'myth', label: 'Myths' },
		{ type: 'people', label: 'People' },
		{ type: 'campaign', label: 'Campaign' },
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
				background: `url(${require('../assets/aetherium_bg.png')})`,
			}}
		>
			<div
				className="bgLayer"
				style={{
					filter: `blur(${bgBlur}px) grayscale(${bgGray})`,
				}}
			/>
			<div className="overlay"></div>
			<div
				className="overflow-container"
				ref={overflowRef}
				onScroll={handleScroll}
			>
				<div className="contentContainer">
					<h1 className="loreTitle">Lore Library</h1>
					<p className="loreSubtitle">
						Explore the world of Aetherium through its places,
						history and myths.
					</p>
					<div className="loreColumns">
						{/* Left column - Categories */}
						<div className="categoriesColumn">
							<h2 className="columnTitle">Categories</h2>
							<div className="categoriesList">
								{categories.map((cat) => (
									<button
										key={cat.type}
										className={`categoryCard ${
											selectedCategory === cat.type
												? 'active'
												: ''
										}`}
										onClick={() =>
											handleCategoryChange(cat.type)
										}
									>
										<span className="label">
											{cat.label}
										</span>
									</button>
								))}
							</div>
						</div>

						{/* Right column - Pages list */}
						<div className="pagesColumn">
							{storeLoading ? (
								<p className="loadingText">Loading…</p>
							) : (
								<ul className="pageList">
									{
										// Filter pages: only show drafts to DMs
										(pagesFromStore || [])
											.filter(
												(p) =>
													p.type ===
													(selectedCategory as any)
											)
											.filter((p) =>
												isDM ? true : !p.draft
											)
											.map((page) => (
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
																	backgroundImage: `url(${Api.resolveAssetUrl(
																		page.bannerUrl
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
																	{
																		page.subtitle
																	}
																</h4>
															)}
															{page.blocks[0]
																?.plainText && (
																<p
																	className="pageExcerpt"
																	dangerouslySetInnerHTML={{
																		__html: generateExcerpt(
																			page
																				.blocks[0]
																				.plainText
																		),
																	}}
																></p>
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
											))
									}
									{pagesFromStore
										.filter(
											(p) =>
												p.type ===
												(selectedCategory as any)
										)
										.filter((p) => (isDM ? true : !p.draft))
										.length === 0 && (
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
			<LoreCreateFab />
		</div>
	);
};

export default LoreHome;
