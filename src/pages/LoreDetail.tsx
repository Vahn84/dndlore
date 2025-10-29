// LoreDetail.tsx (estratto principale)
import React, { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import Api from '../Api';
import RichTextBlock from '../components/richtext/RichTextBlock';
import { useAutoSave } from '../hooks/useAutoSave';
import { Page } from '../types';

const LoreDetail: React.FC<{ isDM: boolean }> = ({ isDM }) => {
	// page viene caricata via Api.getPage(...) come prima
	const [pageDraft, setPageDraft] = useState<
		Page | undefined
	>(/* la pagina caricata */);

	// funzione di salvataggio usata dall'hook
	const saveFn = async (data: Page) => {
		const id = data._id;
		const payload = {
			id,
			title: data.title,
			bannerUrl: data.bannerUrl,
			content: data.content,
			hidden: data.hidden,
			draft: data.draft,
			hiddenSections: data.hiddenSections,
		};
		// opzionale: toast “Saving…”
		const tId = toast.loading('Saving…', { id: 'page-save' });
		try {
			await Api.updatePage(payload);
			toast.success('Saved', { id: tId, duration: 1200 });
		} catch (e: any) {
			toast.error(e?.message || 'Save failed', {
				id: tId,
				duration: 2500,
			});
			throw e;
		}
	};

	const { isSaving, lastSavedAt, error } = useAutoSave(
		pageDraft,
		saveFn,
		1200
	);

	// helper per aggiornare un blocco
	const updateBlock = (idx: number, block: any) => {
		setPageDraft((prev: any) => {
			const next = { ...prev };
			const arr = [...(next.content || [])];
			arr[idx] = block;
			next.content = arr;
			return next;
		});
	};
	const moveBlock = (idx: number, dir: -1 | 1) => {
		setPageDraft((prev: any) => {
			const arr = [...(prev.content || [])];
			const n = idx + dir;
			if (n < 0 || n >= arr.length) return prev;
			const [it] = arr.splice(idx, 1);
			arr.splice(n, 0, it);
			return { ...prev, content: arr };
		});
	};
	const removeBlock = (idx: number) => {
		setPageDraft((prev: any) => {
			const arr = [...(prev.content || [])];
			arr.splice(idx, 1);
			return { ...prev, content: arr };
		});
	};

	return (
		<div className="loreDetail">
			{/* info salvataggio discreta in alto a destra */}
			<div className="saveStatus">
				{isSaving
					? 'Saving…'
					: lastSavedAt
					? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
					: null}
				{error ? <span className="error"> • {error}</span> : null}
			</div>

			<div className="contentContainer">
				<h1 className="pageTitle">{pageDraft?.title}</h1>

				<div className="blocks">
					{pageDraft?.content?.map((b, i) => {
						if (!isDM && b.hidden) return null;

						if (b.type === 'image') {
							return (
								<div
									key={i}
									className={`imageBlock ${
										isDM && b.hidden ? 'rt-hidden' : ''
									}`}
								>
									<img src={b.url} alt="" />
									{/* eventuali tools DM per l’immagine */}
								</div>
							);
						}

						return (
							<RichTextBlock
								key={i}
								value={{ ...b, type: 'rich' }}
								editable={isDM}
								onChange={(next) => updateBlock(i, next)}
								onMoveUp={
									isDM ? () => moveBlock(i, -1) : undefined
								}
								onMoveDown={
									isDM ? () => moveBlock(i, +1) : undefined
								}
								onDelete={
									isDM ? () => removeBlock(i) : undefined
								}
							/>
						);
					})}
				</div>
			</div>
		</div>
	);
};

export default LoreDetail;
