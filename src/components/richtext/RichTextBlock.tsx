import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import { NodeSelection } from '@tiptap/pm/state';
import { editorExtensions } from './extensions';
import { PageBlock } from '../../types';
import Modal from 'react-modal';
import '../../styles/RichTextEditor.scss';
import { ImageIcon } from '@phosphor-icons/react/dist/csr/Image';
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus';
import { TextAlignCenterIcon } from '@phosphor-icons/react/dist/csr/TextAlignCenter';
import { TextAlignJustifyIcon } from '@phosphor-icons/react/dist/csr/TextAlignJustify';
import { TextAlignLeftIcon } from '@phosphor-icons/react/dist/csr/TextAlignLeft';
import { TextAlignRightIcon } from '@phosphor-icons/react/dist/csr/TextAlignRight';
import AssetsManagerModal from '../AssetsManagerModal';
import Api from '../../Api';

Modal.setAppElement('#root');

type Props = {
	value: PageBlock;
	editable: boolean; // true if DM
	onChange?: (next: PageBlock) => void;
	onMoveUp?: () => void;
	onMoveDown?: () => void;
	onDelete?: () => void;
	className?: string;
	/** Hide BubbleMenu when false (default: true) */
	bubbleMenu?: boolean;
	/** Hide FloatingMenu when false (default: true) */
	floatingMenu?: boolean;
	/** Prevent newline (Enter) and keep single line */
	isDM?: boolean;
	singleLine?: boolean;
	/** Render with inline styling variant */
	inline?: boolean;
	toolbar?: boolean;
	/** Optional placeholder */
	placeholder?: string;
	requestFocus?: boolean;
	/** Raw keydown hook for special handling (e.g., block-level shortcuts) */
	onKeyDown?: (e: KeyboardEvent) => void;
	addBlock: () => void;
	insertBlocksAfter?: (blocks: PageBlock[]) => void;
};

/** Minimal TipTap doc used when the block has no content yet */
const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] } as const;

function extractPlainTextFromJSON(doc: any): string {
	if (!doc) return '';
	if (doc.type === 'text') return doc.text || '';
	if (!doc.content || !Array.isArray(doc.content)) return '';
	return doc.content.map(extractPlainTextFromJSON).join(' ');
}

function splitByFirstBlockquote(slice: any) {
	if (!slice.content || !Array.isArray(slice.content)) return null;
	const content = slice.content;

	let before: any[] = [];
	let quote: any = null;
	let after: any[] = [];
	let found = false;

	for (const node of content) {
		if (!found && node.type === 'blockquote') {
			quote = node;
			found = true;
		} else if (!found) {
			before.push(node);
		} else {
			after.push(node);
		}
	}

	if (!quote) return null;

	return {
		before: { type: 'doc', content: before },
		quote: { type: 'doc', content: [quote] },
		after: { type: 'doc', content: after },
	};
}

const RichTextBlock: React.FC<Props> = ({
	value,
	editable,
	onChange,
	onMoveUp,
	onMoveDown,
	onDelete,
	addBlock,
	className = '',
	bubbleMenu = true,
	floatingMenu = true,
	singleLine = false,
	inline = false,
	placeholder,
	requestFocus,
	isDM,
	onKeyDown,
	insertBlocksAfter,
}) => {
	const [assetOpen, setAssetOpen] = useState(false);
	const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
	const [rtModeOpen, setRtModeOpen] = useState(false);
	const rtModeRef = useRef<HTMLDivElement | null>(null);

	// Initial content: only respect current shape -> `value.rich` or empty doc.
	const initialContent = useMemo(() => {
		const content = value?.rich ? value.rich : emptyDoc;
		if (value?.rich && content.content) {
			console.log(`[RichTextBlock] Rendering TipTap doc with ${content.content.length} nodes`);
		}
		return content;
	}, [value?.rich]);

	// Normalize and bubble the editor content to parent as a compact block.
	const pushUp = (ed: any) => {
		if (!editable || typeof onChange !== 'function') return;

		const json = ed.getJSON();
		const plainText = (ed.getText?.() || '')
			.replace(/\u00A0/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();

		const next: any = {
			...(value || {}),
			type: 'rich',
			hidden: value?.hidden ?? false,
			rich: json,
			plainText,
		};

		// Ensure we don't reintroduce legacy fields at the block root
		delete next.content;
		delete next.text;
		delete next.marks;

		onChange(next);
	};

	const editor = useEditor(
		{
			extensions: editorExtensions,
			content: initialContent,
			editable,
			editorProps: {
				attributes: {
					class: `rt-content${inline ? ' rt-inline' : ''}`,
					...(placeholder ? { 'data-placeholder': placeholder } : {}),
				},
				handleKeyDown: (_view, event) => {
					if (
						singleLine &&
						(event as KeyboardEvent).key === 'Enter'
					) {
						event.preventDefault();
						return true;
					}
					if (typeof onKeyDown === 'function') {
						try {
							onKeyDown(event as unknown as KeyboardEvent);
						} catch {}
					}
					return false;
				},
				handlePaste: (view, event, slice) => {
					if (!insertBlocksAfter) return false;
					const split = splitByFirstBlockquote(slice);
					if (!split) return false;

					const { before, quote, after } = split;

					// Replace current block with before segment
					const newContent =
						before.content && before.content.length > 0
							? before
							: { type: 'doc', content: [{ type: 'paragraph' }] };
					const jsonBefore = newContent;

					// Compose the blocks to insert after current block
					const blocksToInsert: PageBlock[] = [];
					if (quote) {
						blocksToInsert.push({
							type: 'rich',
							rich: quote,
							plainText: extractPlainTextFromJSON(quote),
							hidden: false,
						});
					}
					if (after && after.content && after.content.length > 0) {
						blocksToInsert.push({
							type: 'rich',
							rich: after,
							plainText: extractPlainTextFromJSON(after),
							hidden: false,
						});
					}

					// Update current block with before content
					if (onChange) {
						onChange({
							...(value || {}),
							type: 'rich',
							rich: jsonBefore,
							plainText: extractPlainTextFromJSON(jsonBefore),
							hidden: value?.hidden ?? false,
						});
					}

					// Insert remaining blocks after current block
					if (blocksToInsert.length > 0) {
						insertBlocksAfter(blocksToInsert);
					}

					return true;
				},
			},
			onCreate: ({ editor }) => {
				try {
					const dom = editor.view.dom as HTMLElement;
					if (dom) {
						const isEmpty = editor.getText().trim().length === 0;
						dom.setAttribute(
							'data-empty',
							isEmpty ? 'true' : 'false'
						);
						if (placeholder && isDM)
							dom.setAttribute('data-placeholder', placeholder);
					}
					pushUp(editor);
				} catch {}
			},
			onUpdate: ({ editor }) => {
				try {
					const dom = editor.view.dom as HTMLElement;
					if (dom) {
						const isEmpty = editor.getText().trim().length === 0;
						dom.setAttribute(
							'data-empty',
							isEmpty ? 'true' : 'false'
						);
						if (placeholder && isDM)
							dom.setAttribute('data-placeholder', placeholder);
					}
					pushUp(editor);
				} catch {}
			},
		},
		[editable]
	);

	// Force re-render on selection/transaction so image bubble reflects the correct node attrs
	const [, force] = useState(0);
	useEffect(() => {
		if (!editor) return;
		const bump = () => force((n) => n + 1);
		editor.on('selectionUpdate', bump);
		editor.on('transaction', bump);
		return () => {
			editor.off('selectionUpdate', bump);
			editor.off('transaction', bump);
		};
	}, [editor]);

	// Focus newly inserted blocks
	useEffect(() => {
		if (!editor || !requestFocus) return;
		const t = setTimeout(() => {
			try {
				editor.chain().focus('end').run();
			} catch {}
		}, 0);
		return () => clearTimeout(t);
	}, [editor, requestFocus]);

	useEffect(() => {
		if (imageUrl && editor) {
			const _imageUrl = Api.resolveAssetUrl(imageUrl);
			editor.chain().focus().setImage({ src: _imageUrl }).run();
			setImageUrl(undefined);
		}
	}, [imageUrl]);

	// Close the block-type dropdown when clicking outside
	useEffect(() => {
		if (!rtModeOpen) return;
		const onDown = (e: MouseEvent) => {
			const el = rtModeRef.current;
			if (el && !el.contains(e.target as Node)) setRtModeOpen(false);
		};
		document.addEventListener('mousedown', onDown);
		return () => document.removeEventListener('mousedown', onDown);
	}, [rtModeOpen]);

	if (!editor) return null;

	const currentBlockLabel = () => {
		const hasHeading = !!editor?.schema?.nodes?.heading;
		if (hasHeading && editor.isActive('heading')) {
			const lvl = (editor.getAttributes('heading') as any)?.level;
			return lvl ? `Heading ${lvl}` : 'Heading';
		}
		if (editor.isActive('orderedList')) return 'Numbered list';
		if (editor.isActive('bulletList')) return 'Bullet list';
		if (editor.isActive('blockquote')) return 'Quote';
		return 'Normal text';
	};

	const applyHeading = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
		const hasHeading = !!editor?.schema?.nodes?.heading;
		if (!hasHeading) return;
		editor
			.chain()
			.focus()
			.command(({ commands }) => {
				const anyCmds = commands as unknown as Record<string, any>;
				if (typeof anyCmds.setHeading === 'function') {
					anyCmds.setHeading({ level });
					return true;
				}
				if (typeof anyCmds.toggleHeading === 'function') {
					anyCmds.toggleHeading({ level });
					return true;
				}
				if (typeof anyCmds.setNode === 'function') {
					anyCmds.setNode('heading', { level });
					return true;
				}
				return true;
			})
			.run();
	};

	// Resolve the image node position whether it's a NodeSelection (image) or a TextSelection near an inline image
	const getInlineImagePos = (): number | null => {
		if (!editor) return null;
		const { state } = editor;
		const { selection, schema } = state;
		const imgType = schema.nodes.image;
		if (!imgType) return null;

		// If it's a direct node selection of the image
		if (
			selection instanceof NodeSelection &&
			selection.node?.type === imgType
		) {
			return selection.from;
		}

		// If it's a text selection near an inline image, check nodeBefore/nodeAfter
		const $from = selection.$from;
		const before = $from.nodeBefore;
		if (before && before.type === imgType) {
			return $from.pos - before.nodeSize; // starting pos of the inline image
		}
		const after = $from.nodeAfter;
		if (after && after.type === imgType) {
			return $from.pos; // inline image starts exactly at $from.pos
		}

		// Fallback: scan a small window around the cursor
		let found: number | null = null;
		const from = Math.max(0, selection.from - 5);
		const to = Math.min(state.doc.content.size, selection.to + 5);
		state.doc.nodesBetween(from, to, (node, pos) => {
			if (node.type === imgType) {
				found = pos;
				return false;
			}
			return true;
		});
		return found;
	};

	// Helper to get the image node's attrs at the current selection
	const getImageAttrs = (): Record<string, any> => {
		if (!editor) return {};
		const pos = getInlineImagePos();
		if (pos == null) return {};
		const node = editor.state.doc.nodeAt(pos);
		return (node?.attrs as Record<string, any>) || {};
	};

	const setImageFloatAtSelectionLocal = (dir: 'left' | 'right' | 'none') => {
		if (!editor) return;
		const { state, view } = editor;
		const { schema } = state;
		const imgType = schema.nodes.image;
		if (!imgType) return;

		const imgPos = getInlineImagePos();
		if (imgPos == null) return;

		const node = state.doc.nodeAt(imgPos);
		if (!node) return;

		const nextAttrs = { ...node.attrs, float: dir } as any;

		const tr = state.tr.setNodeMarkup(
			imgPos,
			imgType,
			nextAttrs,
			node.marks
		);
		view.dispatch(tr);
		editor.commands.focus();

		try {
			pushUp(editor);
			editor.commands.blur();

			const imgDom = view.nodeDOM(imgPos) as HTMLElement | null;
			const realImg = (
				imgDom?.nodeName === 'IMG'
					? imgDom
					: imgDom?.querySelector('img')
			) as HTMLImageElement | null;

			realImg?.setAttribute('data-float', dir);
			editor.commands.focus();
		} catch (error) {
			console.error('Error setting image float:', error);
		}
	};

	const hiddenRibbon = editable && value?.hidden;

	const addImage = () => {
		if (!editor) return;
		setAssetOpen(true);
	};

	return (
		<div
			className={`rt-block ${className} ${
				hiddenRibbon ? 'rt-hidden' : ''
			}`}
		>
			{/* DM-only contextual toolboxes */}
			{editable && (
				<>
					{bubbleMenu !== false && isDM && (
						<>
							<BubbleMenu
								className="rt-bubble-menu-image"
								editor={editor}
								pluginKey={'image-float-menu'}
								shouldShow={() => getInlineImagePos() != null}
							>
								<div
									className="rt-image-float"
									style={{ display: 'flex' }}
								>
									{(() => {
										const imgFloat = (getImageAttrs()
											.float ?? 'none') as
											| 'left'
											| 'right'
											| 'none';
										return (
											<>
												<button
													className={
														imgFloat === 'left'
															? 'active'
															: ''
													}
													onClick={() =>
														setImageFloatAtSelectionLocal(
															'left'
														)
													}
												>
													<TextAlignLeftIcon />
												</button>
												<button
													className={
														imgFloat === 'right'
															? 'active'
															: ''
													}
													onClick={() =>
														setImageFloatAtSelectionLocal(
															'right'
														)
													}
												>
													<TextAlignRightIcon />
												</button>
												<button
													className={
														imgFloat === 'none'
															? 'active'
															: ''
													}
													onClick={() =>
														setImageFloatAtSelectionLocal(
															'none'
														)
													}
												>
													<TextAlignJustifyIcon />
												</button>
											</>
										);
									})()}
								</div>
							</BubbleMenu>
							<BubbleMenu
								className="rt-bubble-menu"
								editor={editor}
								pluginKey="common"
								shouldShow={({ editor, state }) => {
									const sel = state.selection;
									// Hide when an image node is selected
									const isImageNode =
										sel instanceof NodeSelection &&
										(sel as NodeSelection).node?.type
											?.name === 'image';
									if (isImageNode || editor.isActive('image'))
										return false;
									// Show only for non-empty text selection
									return !sel.empty;
								}}
							>
								<div className="btns">
									<div className="rt-mode" ref={rtModeRef}>
										<button
											type="button"
											className="rt-mode__btn"
											onClick={() =>
												setRtModeOpen((v) => !v)
											}
										>
											{currentBlockLabel()}
										</button>
										{rtModeOpen && (
											<div className="rt-mode-menu">
												<div className="rt-menu-section">
													TURN INTO
												</div>
												<div className="rt-menu-row">
													<button
														className={
															editor.isActive(
																'paragraph'
															)
																? 'active'
																: ''
														}
														onClick={() => {
															editor
																.chain()
																.focus()
																.setParagraph()
																.run();
															setRtModeOpen(
																false
															);
														}}
													>
														Normal text
													</button>
												</div>
												{editor?.schema?.nodes
													?.heading && (
													<div className="rt-menu-row">
														<span
															style={{
																opacity: 0.7,
																marginRight: 6,
															}}
														>
															Heading
														</span>
														{[1, 2, 3, 4, 5, 6].map(
															(level) => (
																<button
																	key={level}
																	className={
																		editor.isActive(
																			'heading',
																			{
																				level,
																			}
																		)
																			? 'active'
																			: ''
																	}
																	onClick={() => {
																		applyHeading(
																			level as
																				| 1
																				| 2
																				| 3
																				| 4
																				| 5
																				| 6
																		);
																		setRtModeOpen(
																			false
																		);
																	}}
																>
																	{level}
																</button>
															)
														)}
													</div>
												)}
												<div className="rt-menu-row">
													<button
														className={
															editor.isActive(
																'orderedList'
															)
																? 'active'
																: ''
														}
														onClick={() => {
															editor
																.chain()
																.focus()
																.toggleOrderedList()
																.run();
															setRtModeOpen(
																false
															);
														}}
													>
														Numbered List
													</button>
												</div>
												<div className="rt-menu-row">
													<button
														className={
															editor.isActive(
																'bulletList'
															)
																? 'active'
																: ''
														}
														onClick={() => {
															editor
																.chain()
																.focus()
																.toggleBulletList()
																.run();
															setRtModeOpen(
																false
															);
														}}
													>
														Bullet List
													</button>
												</div>

												<div className="rt-menu-section">
													WRAP IN
												</div>
												<div className="rt-menu-row">
													<button
														className={
															editor.isActive(
																'blockquote'
															)
																? 'active'
																: ''
														}
														onClick={() => {
															editor
																.chain()
																.focus()
																.toggleBlockquote()
																.run();
															setRtModeOpen(
																false
															);
														}}
													>
														Quote
													</button>
												</div>
												<div className="rt-menu-row">
													<button
														className={
															value?.hidden
																? 'active'
																: ''
														}
														onClick={() => {
															if (onChange)
																onChange({
																	...(value ||
																		{}),
																	type: 'rich',
																	hidden: !value?.hidden,
																});
															setRtModeOpen(
																false
															);
														}}
													>
														Secret
													</button>
												</div>
											</div>
										)}
									</div>

									<button
										onClick={() =>
											editor
												.chain()
												.focus()
												.toggleBold()
												.run()
										}
										className={
											editor.isActive('bold')
												? 'active'
												: ''
										}
									>
										<b>B</b>
									</button>
									<button
										onClick={() =>
											editor
												.chain()
												.focus()
												.toggleItalic()
												.run()
										}
										className={
											editor.isActive('italic')
												? 'active'
												: ''
										}
									>
										<i>I</i>
									</button>
									<button
										onClick={() =>
											editor
												.chain()
												.focus()
												.toggleUnderline()
												.run()
										}
										className={
											editor.isActive('underline')
												? 'active'
												: ''
										}
									>
										<u>U</u>
									</button>
									<button
										onClick={() =>
											editor
												.chain()
												.focus()
												.toggleTextAlign('left')
												.run()
										}
										className={
											editor.isActive({
												textAlign: 'left',
											})
												? 'active'
												: ''
										}
									>
										<TextAlignLeftIcon />
									</button>
									<button
										onClick={() =>
											editor
												.chain()
												.focus()
												.toggleTextAlign('center')
												.run()
										}
										className={
											editor.isActive({
												textAlign: 'center',
											})
												? 'active'
												: ''
										}
									>
										<TextAlignCenterIcon />
									</button>
									<button
										onClick={() =>
											editor
												.chain()
												.focus()
												.toggleTextAlign('right')
												.run()
										}
										className={
											editor.isActive({
												textAlign: 'right',
											})
												? 'active'
												: ''
										}
									>
										<TextAlignRightIcon />
									</button>
									<button
										onClick={() =>
											editor
												.chain()
												.focus()
												.toggleTextAlign('justify')
												.run()
										}
										className={
											editor.isActive({
												textAlign: 'justify',
											})
												? 'active'
												: ''
										}
									>
										<TextAlignJustifyIcon />
									</button>
								</div>
							</BubbleMenu>
						</>
					)}

					{floatingMenu !== false && isDM && (
						<FloatingMenu className="rt-float" editor={editor}>
							<div className="btns">
								<button
									onClick={() =>
										editor
											.chain()
											.focus()
											.setParagraph()
											.run()
									}
									className={
										editor.isActive('paragraph')
											? 'active'
											: ''
									}
								>
									P
								</button>
								<button
									onClick={() =>
										editor
											.chain()
											.focus()
											.toggleBlockquote()
											.run()
									}
									className={
										editor.isActive('blockquote')
											? 'active'
											: ''
									}
								>
									&ldquo; &rdquo;
								</button>
								<button
									onClick={() =>
										editor
											.chain()
											.focus()
											.toggleBulletList()
											.run()
									}
									className={
										editor.isActive('bulletList')
											? 'active'
											: ''
									}
								>
									• List
								</button>
							</div>
						</FloatingMenu>
					)}

					{/* Right-side toolbar (move/delete/add) visible on hover */}
					{toolbar && isDM && (
						<div className="rt-toolbar">
							<div className="rt-add-block">
								<PlusIcon
									size={24}
									type="button"
									className="add-block-btn"
									aria-label="Add block below"
									onClick={addBlock}
								/>
								<ImageIcon
									size={24}
									type="button"
									className="add-block-btn"
									aria-label="Add image"
									onClick={() => addImage()}
								/>
							</div>

							<div className="rt-sideTools">
								{onMoveUp && (
									<button title="Move up" onClick={onMoveUp}>
										↑
									</button>
								)}
								{onMoveDown && (
									<button
										title="Move down"
										onClick={onMoveDown}
									>
										↓
									</button>
								)}
								{onDelete && (
									<button title="Delete" onClick={onDelete}>
										✕
									</button>
								)}
							</div>
						</div>
					)}
				</>
			)}

			<EditorContent editor={editor} />
			<AssetsManagerModal
				isOpen={assetOpen}
				onClose={() => setAssetOpen(false)}
				onSelect={(asset) => {
					setImageUrl(asset.url);
					setAssetOpen(false);
				}}
			/>
		</div>
	);
};

export default RichTextBlock;
