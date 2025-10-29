import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import BulletList from '@tiptap/extension-bullet-list';
import ListItem from '@tiptap/extension-list-item';
import Blockquote from '@tiptap/extension-blockquote';
import BubbleMenu from '@tiptap/extension-bubble-menu';
import FloatingMenu from '@tiptap/extension-floating-menu';

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
  Link.configure({ openOnClick: false, autolink: true }),
  BulletList,
  ListItem,
  Blockquote,
  FloatingMenu,
  BubbleMenu,
];
