import React, { useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { editorExtensions } from './extensions';
import { BubbleMenu } from '@tiptap/react/menus';
import { FloatingMenu } from '@tiptap/react/menus';
import { PageBlock } from '../../types';
import '../../styles/RichText.scss';

type Props = {
	value: PageBlock;
	editable: boolean; // true se DM
	onChange?: (next: PageBlock) => void;
	onMoveUp?: () => void;
	onMoveDown?: () => void;
	onDelete?: () => void;
	className?: string;
};

// fallback: converte un vecchio "text" in doc TipTap
const fromLegacy = (block: PageBlock) => {
	if (block.rich) return block.rich;
	if (block.text) {
		return {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: block.text }],
				},
			],
		};
	}
	return { type: 'doc', content: [{ type: 'paragraph' }] };
};

const RichTextBlock: React.FC<Props> = ({
	value,
	editable,
	onChange,
	onMoveUp,
	onMoveDown,
	onDelete,
	className = '',
}) => {
	const initialJSON = useMemo(() => fromLegacy(value), [value]);

	const editor = useEditor(
		{
			extensions: editorExtensions,
			content: initialJSON,
			editable,
			editorProps: {
				attributes: { class: 'rt-content' },
			},
			onUpdate({ editor }) {
				if (!onChange) return;
				const json = editor.getJSON();
				onChange({
					...value,
					type: 'rich',
					rich: json,
					text: undefined,
				});
			},
		},
		[editable]
	);

	// Nota: in sola lettura EditorContent rende markup identico (no textarea)
	if (!editor) return null;

	const hiddenRibbon = editable && value.hidden;

	return (
		<div
			className={`rt-block ${className} ${
				hiddenRibbon ? 'rt-hidden' : ''
			}`}
		>
			{/* Toolbox contestuali solo per DM */}
			{editable && (
				<>
					<BubbleMenu className="rt-bubble" editor={editor}>
						<div className="btns">
							<button
								onClick={() =>
									editor.chain().focus().toggleBold().run()
								}
								className={
									editor.isActive('bold') ? 'active' : ''
								}
							>
								<b>B</b>
							</button>
							<button
								onClick={() =>
									editor.chain().focus().toggleItalic().run()
								}
								className={
									editor.isActive('italic') ? 'active' : ''
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
									editor.isActive('underline') ? 'active' : ''
								}
							>
								<u>U</u>
							</button>
						</div>
					</BubbleMenu>

					<FloatingMenu className="rt-float" editor={editor}>
						<div className="btns">
							<button
								onClick={() =>
									editor.chain().focus().setParagraph().run()
								}
								className={
									editor.isActive('paragraph') ? 'active' : ''
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

					{/* Toolbar “a destra” del blocco (move/delete/hidden) visibile on-hover */}
					<div className="rt-sideTools">
						{onMoveUp && (
							<button title="Move up" onClick={onMoveUp}>
								↑
							</button>
						)}
						{onMoveDown && (
							<button title="Move down" onClick={onMoveDown}>
								↓
							</button>
						)}
						{onDelete && (
							<button title="Delete" onClick={onDelete}>
								✕
							</button>
						)}
					</div>
				</>
			)}

			<EditorContent editor={editor} />
		</div>
	);
};

export default RichTextBlock;
