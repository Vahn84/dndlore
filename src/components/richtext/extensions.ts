import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import BulletList from '@tiptap/extension-bullet-list';
import ListItem from '@tiptap/extension-list-item';
import Blockquote from '@tiptap/extension-blockquote';
import BubbleMenu from '@tiptap/extension-bubble-menu';
import FloatingMenu from '@tiptap/extension-floating-menu';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Bold from '@tiptap/extension-bold';
import TextAlign from '@tiptap/extension-text-align';
import ImageResize from 'tiptap-extension-resize-image';
import { Dropcursor } from '@tiptap/extensions';
import { Plugin } from 'prosemirror-state';

// Image with float attribute + immediate wrapper sync so text can wrap
const WrappedImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			float: {
				default: 'none',
				parseHTML: (el: HTMLElement) =>
					el.getAttribute('data-float') || 'none',
				renderHTML: (attrs: any) => ({
					'data-float': attrs.float || 'none',
				}),
			},
		};
	},
	addProseMirrorPlugins() {
		return [
			new Plugin({
				view(view) {
					const sync = () => {
						const imgs =
							view.dom.querySelectorAll<HTMLImageElement>(
								'img[data-float]'
							);
						imgs.forEach((img) => {
							const f = img.getAttribute('data-float') || 'none';
							const wrapper = img.closest<HTMLElement>(
								'[data-resize-container]'
							);
							if (
								wrapper &&
								wrapper.getAttribute('data-float') !== f
							) {
								wrapper.setAttribute('data-float', f);
							}
						});
					};
					const rafSync = () => requestAnimationFrame(sync);
					rafSync();
					const mo = new MutationObserver(rafSync);
					mo.observe(view.dom, {
						childList: true,
						subtree: true,
						attributes: true,
						attributeFilter: ['data-float'],
					});
					return {
						update: rafSync,
						destroy() {
							mo.disconnect();
						},
					};
				},
			}),
		];
	},
});

// ordine pensato per p, blockquote, bullet list, grassetto, cursivo, underline
export const editorExtensions = [
	StarterKit.configure({
		orderedList: false, // non ci serve per ora
		bulletList: {},
		blockquote: {},
		heading: false,
		code: false,
		codeBlock: false,
	}),
	Underline,
	Bold,
	Link.configure({ openOnClick: false, autolink: true }),
	BulletList,
	ListItem,
	Blockquote,
	FloatingMenu,
	TextAlign.configure({
		types: ['paragraph', 'heading'],
		defaultAlignment: 'left',
	}),
	Heading.configure({
		levels: [1, 2, 3],
		HTMLAttributes: { class: 'richtext-heading' },
	}),
	WrappedImage.configure({
		inline: true,
		HTMLAttributes: { class: 'richtext-image' },
		resize: {
			enabled: true,
			alwaysPreserveAspectRatio: true,
		},
	}),

	Dropcursor.configure({
		color: 'gold',
		class: 'richtext-dropcursor',
	}),
];
