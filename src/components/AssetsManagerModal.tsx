import React, { useEffect, useRef, useState } from 'react';
import Modal from 'react-modal';
import { X, Folder, FolderOpen, ArrowLeft } from 'phosphor-react';
import { useAppStore, type Asset, type AssetFolder } from '../store/appStore';
import '../styles/AssetsManager.scss';
import Api from '../Api';
import { toast } from 'react-hot-toast';

Modal.setAppElement('#root');

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (asset: Asset) => void;
};

const AssetsManagerModal: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
	// --- store selectors (split to avoid object identity churn) ---
	const assets = useAppStore((s) => s.data.assets);
	const folders = useAppStore((s) => s.data.assetFolders);
	const loadAssets = useAppStore((s) => s.loadAssets);
	const loadAssetFolders = useAppStore((s) => s.loadAssetFolders);
	const createAssetFromFile = useAppStore((s) => s.createAssetFromFile);
	const createAssetFromUrl = useAppStore((s) => s.createAssetFromUrl);
	const deleteAsset = useAppStore((s) => s.deleteAsset);
	const createAssetFolder = useAppStore((s) => s.createAssetFolder);
	const deleteAssetFolder = useAppStore((s) => s.deleteAssetFolder);
	const moveAssetToFolder = useAppStore((s) => s.moveAssetToFolder);

	// keep a stable ref for the loader to avoid effect loops
	const loadAssetsRef = useRef(loadAssets);
	const loadAssetFoldersRef = useRef(loadAssetFolders);
	useEffect(() => {
		loadAssetsRef.current = loadAssets;
		loadAssetFoldersRef.current = loadAssetFolders;
	}, [loadAssets, loadAssetFolders]);

	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [urlInput, setUrlInput] = useState('');
	const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
	const [newFolderName, setNewFolderName] = useState('');
	const [showNewFolderInput, setShowNewFolderInput] = useState(false);
	const [movingAssetId, setMovingAssetId] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen) {
			setSelectedId(null);
			setUrlInput('');
			setCurrentFolderId(null);
			setShowNewFolderInput(false);
			setNewFolderName('');
			loadAssetsRef.current?.();
			loadAssetFoldersRef.current?.();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	const items = assets?.data || [];
	const foldersList = folders?.data || [];
	const loading = !!assets?.loading || !!folders?.loading;

	// Filter assets by current folder
	const filteredAssets = items.filter((a) =>
		currentFolderId ? a.folderId === currentFolderId : !a.folderId
	);

	const selected = selectedId
		? items.find((a) => a._id === selectedId) ?? null
		: null;

	const currentFolder = currentFolderId
		? foldersList.find((f) => f._id === currentFolderId)
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

	const onDeleteAsset = async (assetId: string, e?: React.MouseEvent) => {
		if (e) {
			e.stopPropagation();
		}
		await deleteAsset(assetId);
		if (selectedId === assetId) {
			setSelectedId(null);
		}
	};

	const onCreateFolder = async () => {
		const name = newFolderName.trim();
		if (!name) {
			toast.error('Folder name is required');
			return;
		}
		try {
			await createAssetFolder(name);
			setNewFolderName('');
			setShowNewFolderInput(false);
			toast.success('Folder created');
		} catch (err: any) {
			toast.error(err?.message || 'Failed to create folder');
		}
	};

	const onDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		try {
			await deleteAssetFolder(folderId);
			toast.success('Folder deleted');
		} catch (err: any) {
			toast.error(
				err?.response?.data?.error || 'Failed to delete folder'
			);
		}
	};

	const onMoveAsset = async (
		assetId: string,
		targetFolderId: string | null
	) => {
		try {
			await moveAssetToFolder(assetId, targetFolderId);
			setMovingAssetId(null);
			toast.success('Asset moved');
		} catch (err: any) {
			toast.error(err?.message || 'Failed to move asset');
		}
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
							<div className="assetmgr__right">
								<div className="modal__actions">
									<button
										type="button"
										className="draggable__btn draggable__btn--muted"
										style={{ display: 'flex' }}
										onClick={onClose}
									>
										<X size={16} weight="bold" />
									</button>
								</div>
							</div>
						</header>

						<div className="asset-manager-columns-container">
							<div className="assetmgr__sidebar assetmgr__sidebar--left">
								{/* Breadcrumb navigation */}
								<div className="assetmgr__breadcrumb">
									{currentFolderId ? (
										<>
											<button
												type="button"
												className="assetmgr__breadcrumb-btn"
												onClick={() =>
													setCurrentFolderId(null)
												}
											>
												<ArrowLeft
													size={16}
													weight="bold"
												/>
												Root
											</button>
											<span className="assetmgr__breadcrumb-sep">
												/
											</span>
											<span className="assetmgr__breadcrumb-current">
												{currentFolder?.name ||
													'Unknown'}
											</span>
										</>
									) : (
										<span className="assetmgr__breadcrumb-current">
											Root
										</span>
									)}
								</div>

								{/* LEFT: scrollable gallery area */}
								<div className="assetmgr__grid assetmgr__grid--scroll">
									{/* Show folders only when in root */}
									{!currentFolderId &&
										foldersList.map((folder) => (
											<button
												key={folder._id}
												type="button"
												className="assetmgr__folder"
												onClick={() =>
													setCurrentFolderId(
														folder._id
													)
												}
											>
												<div className="assetmgr__folder-icon">
													<Folder
														size={48}
														weight="duotone"
													/>
												</div>
												<div className="assetmgr__folder-name">
													{folder.name}
												</div>
												<button
													type="button"
													className="assetmgr__deleteBtn"
													onClick={(e) =>
														onDeleteFolder(
															folder._id,
															e
														)
													}
													title="Delete folder"
												>
													<X
														size={20}
														weight="bold"
													/>
												</button>
											</button>
										))}

									{/* Show assets filtered by folder */}
									{filteredAssets.map((a) => (
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
												<button
													type="button"
													className="assetmgr__deleteBtn"
													onClick={(e) =>
														onDeleteAsset(a._id, e)
													}
													title="Delete asset"
												>
													<X
														size={20}
														weight="bold"
													/>
												</button>
											</div>
											<div className="assetmgr__meta">
												<span className="assetmgr__name">
													{a.url.split('/').pop()}
												</span>
											</div>
										</button>
									))}
								</div>
							</div>
							{/* RIGHT: fixed details panel */}
							<div className="assetmgr__sidebar">
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
										{!showNewFolderInput && (
											<button
												type="button"
												className="draggable__btn draggable__btn--small draggable__btn--muted"
												onClick={() =>
													setShowNewFolderInput(true)
												}
											>
												New Folder
											</button>
										)}

										{/* New folder input */}
										{showNewFolderInput && (
											<div className="assetmgr__newfolder-inline">
												<input
													style={{ margin: 0 }}
													type="text"
													placeholder="Folder name…"
													value={newFolderName}
													onChange={(e) =>
														setNewFolderName(
															e.target.value
														)
													}
													onKeyDown={(e) => {
														if (e.key === 'Enter')
															onCreateFolder();
														if (
															e.key === 'Escape'
														) {
															setShowNewFolderInput(
																false
															);
															setNewFolderName(
																''
															);
														}
													}}
													className="tsm__input"
													autoFocus
												/>
												<button
													type="button"
													style={{ margin: 0 }}
													className="draggable__btn draggable__btn--small"
													onClick={onCreateFolder}
												>
													Create
												</button>
												<button
													type="button"
													style={{ margin: 0 }}
													className="draggable__btn draggable__btn--small draggable__btn--muted"
													onClick={() => {
														setShowNewFolderInput(
															false
														);
														setNewFolderName('');
													}}
												>
													Cancel
												</button>
											</div>
										)}
									</div>
								) : (
									<div className="assetmgr__details">
										<div className="assetmgr__preview">
											<div className="assetmgr__previewInner">
												<img
													src={resolveAssetUrl(
														selected.url
													)}
													className="assetmgr__previewImg"
													alt="Preview"
												/>
											</div>
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
												className="draggable__btn draggable__btn--secondary  draggable__btn--muted"
												onClick={triggerFilePicker}
											>
												Upload new
											</button>
											<input
												ref={fileInputRef}
												type="file"
												accept="image/*"
												className="assetmgr__file"
												onChange={onFileChange}
											/>
										</div>

										{/* Move asset dropdown */}
										<div className="assetmgr__move">
											<label className="assetmgr__move-label">
												Move to folder:
											</label>
											<select
												value={selected.folderId || ''}
												onChange={(e) => {
													const targetId =
														e.target.value || null;
													onMoveAsset(
														selected._id,
														targetId
													);
												}}
												className="tsm__input"
											>
												<option value="">Root</option>
												{foldersList.map((f) => (
													<option
														key={f._id}
														value={f._id}
													>
														{f.name}
													</option>
												))}
											</select>
										</div>
										{!showNewFolderInput && (
											<button
												type="button"
												className="draggable__btn draggable__btn--small  draggable__btn--muted"
												onClick={() =>
													setShowNewFolderInput(true)
												}
												style={{
													display: 'flex',
													margin: '0 auto',
												}}
											>
												New Folder
											</button>
										)}

										{/* New folder input */}
										{showNewFolderInput && (
											<div className="assetmgr__newfolder-inline">
												<input
													style={{ margin: 0 }}
													type="text"
													placeholder="Folder name…"
													value={newFolderName}
													onChange={(e) =>
														setNewFolderName(
															e.target.value
														)
													}
													onKeyDown={(e) => {
														if (e.key === 'Enter')
															onCreateFolder();
														if (
															e.key === 'Escape'
														) {
															setShowNewFolderInput(
																false
															);
															setNewFolderName(
																''
															);
														}
													}}
													className="tsm__input"
													autoFocus
												/>
												<button
													type="button"
													className="draggable__btn draggable__btn--small"
													onClick={onCreateFolder}
													style={{ margin: 0 }}
												>
													Create
												</button>
												<button
													type="button"
													className="draggable__btn draggable__btn--small draggable__btn--muted"
													style={{ margin: 0 }}
													onClick={() => {
														setShowNewFolderInput(
															false
														);
														setNewFolderName('');
													}}
												>
													Cancel
												</button>
											</div>
										)}
										{/* <div className="assetmgr__upload assetmgr__upload--secondary">
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

										</div> */}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</Modal>
	);
};

export default AssetsManagerModal;
