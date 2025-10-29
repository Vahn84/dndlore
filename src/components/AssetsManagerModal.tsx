import React, { useEffect, useRef, useState } from 'react';
import Modal from 'react-modal';
import { useAppStore, type Asset } from '../store/appStore';
import '../styles/AssetsManager.scss';
import Api from '../Api';

Modal.setAppElement('#root');

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (asset: Asset) => void;
};

const AssetsManagerModal: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
	// --- store selectors (split to avoid object identity churn) ---
	const assets = useAppStore((s) => s.data.assets);
	const loadAssets = useAppStore((s) => s.loadAssets);
	const createAssetFromFile = useAppStore((s) => s.createAssetFromFile);
	const createAssetFromUrl = useAppStore((s) => s.createAssetFromUrl);
	const deleteAsset = useAppStore((s) => s.deleteAsset);

	// keep a stable ref for the loader to avoid effect loops
	const loadAssetsRef = useRef(loadAssets);
	useEffect(() => {
		loadAssetsRef.current = loadAssets;
	}, [loadAssets]);

	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [urlInput, setUrlInput] = useState('');

	useEffect(() => {
		if (isOpen) {
			setSelectedId(null);
			setUrlInput('');
			loadAssetsRef.current?.();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	const items = assets?.data || [];
	const loading = !!assets?.loading;
	const selected = selectedId
		? items.find((a) => a._id === selectedId) ?? null
		: null;

	const triggerFilePicker = () => fileInputRef.current?.click();
	const resolveAssetUrl = Api.resolveAssetUrl;
	const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
		e
	) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const created = await createAssetFromFile(file);
		if (created) setSelectedId(created._id);
		if (fileInputRef.current) fileInputRef.current.value = '';
	};

	const onAddFromUrl = async () => {
		const url = urlInput.trim();
		if (!url) return;
		const created = await createAssetFromUrl(url);
		if (created) {
			setSelectedId(created._id);
			setUrlInput('');
		}
	};

	const onUse = () => {
		if (selected) {
			onSelect(selected);
			onClose();
		}
	};

	const onDelete = async () => {
		if (!selectedId) return;
		await deleteAsset(selectedId);
		setSelectedId(null);
	};

	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={onClose}
			contentLabel="Asset Manager"
			overlayClassName="modal__overlay"
			className="modal__content modal__content--asset_mngr"
		>
			<div className="modal__body">
				<div className="modal__body_content">
					<div className="assetmgr">
						<header className="assetmgr__bar">
							<div className="assetmgr__left">
								<span className="assetmgr__title">Assets</span>
								{loading && (
									<span className="assetmgr__muted">
										{' '}
										Loading…
									</span>
								)}
							</div>
							{/* right header intentionally empty; upload lives in the sidebar */}
							<div className="assetmgr__right" />
						</header>

						<div className="assetmgr__layout">
							{/* LEFT: gallery grid */}
							<div className="assetmgr__grid">
								{items.map((a) => (
									<button
										key={a._id}
										type="button"
										className={`assetmgr__card ${
											selectedId === a._id
												? 'is-selected'
												: ''
										}`}
										onClick={() => setSelectedId(a._id)}
										onDoubleClick={() => {
											setSelectedId(a._id);
											onSelect(a);
											onClose();
										}}
										aria-pressed={selectedId === a._id}
									>
										<div className="assetmgr__thumbWrap">
											<img
												src={resolveAssetUrl(a.url)}
												className="assetmgr__thumb"
												alt=""
											/>
										</div>
										<div className="assetmgr__meta">
											<span className="assetmgr__name">
												{a.url.split('/').pop()}
											</span>
										</div>
									</button>
								))}
							</div>

							{/* RIGHT: upload & details panel */}
							<aside className="assetmgr__sidebar">
								{!selected ? (
									<div className="assetmgr__empty">
										<div
											className="assetmgr__icon"
											aria-hidden
										>
											▦
										</div>
										<div className="assetmgr__muted">
											No asset selected
										</div>

										<div className="assetmgr__upload">
											<button
												type="button"
												className="draggable__btn"
												onClick={triggerFilePicker}
											>
												New asset
											</button>
											<input
												ref={fileInputRef}
												type="file"
												accept="image/*"
												className="assetmgr__file"
												onChange={onFileChange}
											/>

											{/* <div className="assetmgr__url">
												<input
													type="text"
													placeholder="Paste image URL…"
													value={urlInput}
													onChange={(e) =>
														setUrlInput(
															e.target.value
														)
													}
													className="tsm__input"
												/>
												<button
													type="button"
													className="draggable__btn"
													onClick={onAddFromUrl}
												>
													Add from URL
												</button>
											</div> */}
										</div>
									</div>
								) : (
									<div className="assetmgr__details">
										<div className="assetmgr__preview">
											<img
												src={resolveAssetUrl(selected.url)}
												className="assetmgr__previewImg"
												alt="Preview"
											/>
										</div>
										<div className="assetmgr__actions">
											<button
												type="button"
												className="draggable__btn"
												onClick={onUse}
											>
												Use asset
											</button>
											<button
												type="button"
												className="draggable__btn draggable__btn--muted"
												onClick={onDelete}
											>
												Delete
											</button>
										</div>

										<div className="assetmgr__upload assetmgr__upload--secondary">
											<button
												type="button"
												className="draggable__btn"
												onClick={triggerFilePicker}
											>
												Upload another
											</button>
											<input
												ref={fileInputRef}
												type="file"
												accept="image/*"
												className="assetmgr__file"
												onChange={onFileChange}
											/>

											{/* <div className="assetmgr__url">
												<input
													type="text"
													placeholder="Paste image URL…"
													value={urlInput}
													onChange={(e) =>
														setUrlInput(
															e.target.value
														)
													}
													className="tsm__input"
												/>
												<button
													type="button"
													className="draggable__btn"
													onClick={onAddFromUrl}
												>
													Add from URL
												</button>
											</div> */}
										</div>
									</div>
								)}
							</aside>
						</div>
					</div>
				</div>

				<div className="modal__actions">
					<button
						type="button"
						className="draggable__btn draggable__btn--muted"
						onClick={onClose}
					>
						Close
					</button>
				</div>
			</div>
		</Modal>
	);
};

export default AssetsManagerModal;
