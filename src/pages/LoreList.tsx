import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Api from '../Api';
import { Page } from '../types';
import '../styles/LoreList.scss';
import LoreCreateFab from '../components/LoreCreateFab';

interface LoreListProps {
	isDM: boolean;
}

/**
 * Lists all lore pages of a given type. Fetches pages from the API and
 * displays them in a simple list. Provides a create button for DM users.
 */
const LoreList: React.FC<LoreListProps> = ({ isDM }) => {
	const { type } = useParams<{ type: string }>();
	const [pages, setPages] = useState<Page[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const navigate = useNavigate();

	useEffect(() => {
		async function load() {
			if (!type) return;
			setLoading(true);
			try {
				const data = await Api.getPages(type);
				setPages(data);
			} catch (err) {
				console.error('Failed to load pages', err);
			} finally {
				setLoading(false);
			}
		}
		load();
	}, [type]);

	const handleCreate = () => {
		if (type) {
			navigate(`/lore/${type}/new`);
		}
	};

	return (
		<div className="loreList offset-container">
			<h1 className="listTitle">{type}</h1>

			{loading ? (
				<p>Loading…</p>
			) : (
				<ul className="pageList">
					{pages.map((page) => (
						<li
							key={page._id}
							className="pageListItem"
							onClick={() =>
								navigate(`/lore/${type}/${page._id}`)
							}
						>
							<div className="pageCard">
								{page.bannerUrl && (
									<div
										className="thumb"
										style={{
											backgroundImage: `url(${page.bannerUrl})`,
										}}
									/>
								)}
								<div className="meta">
									<h3 className="pageTitle">{page.title}</h3>
									{page.draft && (
										<span className="draftBadge">
											Draft
										</span>
									)}
								</div>
							</div>
						</li>
					))}
					{pages.length === 0 && <p>No pages found.</p>}
				</ul>
			)}
			<LoreCreateFab />
		</div>
	);
};

export default LoreList;
