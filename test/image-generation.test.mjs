import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import * as sass from 'sass';

const require = createRequire(import.meta.url);
function load(relative, imports = {}) {
  const filename = new URL(relative, import.meta.url).pathname;
  const { code } = transformSync(fs.readFileSync(filename, 'utf8'), { filename, babelrc: false, configFile: false,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-react', '@babel/preset-typescript'] });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in imports ? imports[name] : require(name), module, module.exports);
  return module.exports;
}
const helpers = load('../src/imageGeneration.ts');
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const button = (tree, label) => nodes(tree).find(node => node.type === 'button' && node.props.children === label);

test('asset cards retain filenames below images except in the pinned references view', () => {
  const asset = { _id: 'a', url: '/uploads/original-portrait.webp', name: 'Image display name', reference: { kind: 'character', label: 'Obyron' } };
  const store = { isDM: () => true, data: { assets: { data: [asset] }, assetFolders: { data: [] } } };
  const Modal = Object.assign(() => null, { setAppElement() {} });
  const Manager = load('../src/components/AssetsManagerModal.tsx', {
    react: { ...React, useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }), useEffect() {} },
    'react-modal': Modal,
    ...Object.fromEntries(['X', 'Folder', 'ArrowLeft', 'Trash'].map(name => [`@phosphor-icons/react/dist/csr/${name}`, { [`${name}Icon`]: () => null }])),
    '../store/appStore': { useAppStore: select => select(store) },
    '../styles/AssetsManager.scss': {}, '../styles/ImageStudio.scss': {},
    '../Api': { resolveAssetUrl: url => url },
    './ConfirmModal': () => null, './AssetGenerationPanel': () => null, './AssetReferenceEditor': () => null,
    '../imageGeneration': helpers, '../store/imageJobsStore': {},
  }).default;
  for (const tab of ['library', 'references', 'drafts']) {
    asset.reviewStatus = tab === 'drafts' ? 'draft' : 'approved';
    const tree = Manager({ isOpen: true, onClose() {}, initialTab: tab });
    const card = nodes(tree).find(n => n.props?.className?.startsWith('assetmgr__card '));
    assert.ok(card);
    const children = card.props.children;
    assert.equal(children[0].props.className, 'assetmgr__thumbWrap');
    assert.equal(children[1].props.className, 'assetmgr__meta');
    const caption = nodes(card).find(n => n.props?.className === 'assetmgr__name');
    assert.equal(caption.props.children, tab === 'references' ? 'Obyron' : 'original-portrait.webp');
  }
});

test('asset gallery keeps uniform widths and the existing ellipsized caption style', () => {
  const css = sass.compile(new URL('../src/styles/AssetsManager.scss', import.meta.url).pathname).css;
  const card = css.match(/\.assetmgr__card \{([^}]+)\}/g).join('\n');
  assert.match(card, /flex: 0 0 30%/);
  assert.match(card, /min-width: 0/);
  assert.match(card, /flex-direction: column/);
  const caption = css.match(/\.assetmgr__name \{([^}]+)\}/)[1];
  assert.match(caption, /text-overflow: ellipsis/);
  assert.match(caption, /white-space: nowrap/);
  assert.match(caption, /overflow: hidden/);
});

function panelHarness({ assets = [], jobs = [], submit = async () => jobs[0] } = {}) {
  const state = []; let cursor = 0;
  const hooks = { ...React,
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }]; },
    useRef(initial) { const index = cursor++; return state[index] ||= { current: initial }; },
  };
  let selected = null;
  const store = { data: { assets: { data: assets } } };
  const api = { resolveAssetUrl: url => url, reviewImageAsset: async (id, status) => ({ ...store.data.assets.data.find(a => a._id === id), reviewStatus: status }) };
  const Panel = load('../src/components/AssetGenerationPanel.tsx', {
    react: hooks,
    '../Api': api,
    '../store/appStore': { useAppStore: select => select(store) },
    '../store/imageJobsStore': {
      useImageJobsStore: () => ({ jobs, configured: true, model: 'test-image-model', submit, refresh() {} }),
      updateImageAsset: asset => { store.data.assets.data = store.data.assets.data.map(old => old._id === asset._id ? asset : old); },
    },
    '../imageGeneration': helpers,
    './AssetReferenceEditor': () => null,
  }).default;
  return { render: (props = {}) => { cursor = 0; return Panel({ context: { title: 'Session 99', text: 'At the gate.' }, folderId: null, onSelect: asset => { selected = asset; }, ...props }); }, selected: () => selected };
}

test('image context includes readable recap prose, not hidden blocks or asset metadata', () => {
  assert.match(helpers.createImageRequestId(), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(helpers.imageContextText([{ rich: { type: 'doc', content: [{ type: 'text', text: 'At the gate.' }] } }, { plainText: 'Legacy recap.' }, { hidden: true, rich: { text: 'DM secret' } }, { url: '/uploads/private.png', assetId: 'secret-id' }]), 'At the gate.\nLegacy recap.');
  assert.equal(helpers.imageContextText('x'.repeat(19000)).length, 18000);
  assert.equal(helpers.isApprovedAsset({}), true);
  assert.equal(helpers.isApprovedAsset({ reviewStatus: 'draft' }), false);
  assert.equal(helpers.isApprovedAsset({ reviewStatus: 'rejected' }), false);
});

test('draft review requires approval before selecting an image as a banner', async () => {
  const asset = { _id: 'a', url: '/uploads/draft.webp', reviewStatus: 'draft' };
  const h = panelHarness({ assets: [asset], jobs: [{ _id: 'j', status: 'ready', assetId: 'a', prompt: 'The gate', context: '', references: [], createdAt: '2026-09-07' }] });
  assert.equal(button(h.render(), 'Use asset'), undefined);
  await button(h.render(), 'Approve image').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  button(h.render(), 'Use asset').props.onClick();
  assert.equal(h.selected().reviewStatus, 'approved');
  assert.equal(button(h.render({ onSelect: undefined }), 'Use asset'), undefined, 'global review does not silently attach an asset');
});

test('a rapid double-submit creates one job with the selected character reference and editable context', async () => {
  const held = Promise.withResolvers(); const requests = [];
  const h = panelHarness({ assets: [{ _id: 'a', url: '/uploads/a.png', reference: { kind: 'character', label: 'Elarielle' } }], submit: input => { requests.push(input); return held.promise; } });
  nodes(h.render()).find(node => node.type === 'textarea' && node.props.required).props.onChange({ target: { value: 'The party at the gate' } });
  nodes(h.render()).find(node => node.props?.className === 'image-studio__reference').props.onClick();
  const form = nodes(h.render()).find(node => node.type === 'form');
  const first = form.props.onSubmit({ preventDefault() {} });
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].referenceIds, ['a']);
  assert.equal(requests[0].context, 'Session 99\n\nAt the gate.');
  assert.equal(requests[0].format, 'landscape');
  assert.equal('quality' in requests[0], false);
  held.resolve({ _id: 'new-job' }); await first;
});

test('retry after a lost submission response reuses its request ID', async () => {
  const requests = [];
  const h = panelHarness({ submit: async input => { requests.push(input); throw new Error('Network lost'); } });
  nodes(h.render()).find(node => node.type === 'textarea' && node.props.required).props.onChange({ target: { value: 'The gate' } });
  const submit = () => nodes(h.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await submit(); await submit();
  assert.equal(requests[0].requestId, requests[1].requestId);
  assert.ok(nodes(h.render()).some(node => node.props?.role === 'alert'));
});

test('generation markup and progress use themed, accessible controls', () => {
  const h = panelHarness();
  const html = renderToStaticMarkup(h.render());
  assert.match(html, /Campaign context/);
  assert.match(html, /Uses your Codex allowance/);
  assert.doesNotMatch(html, /OPENAI_API_KEY|API billing|>Quality</);
  assert.doesNotMatch(html, /type="checkbox"/);
  const css = sass.compile(new URL('../src/styles/ImageStudio.scss', import.meta.url).pathname).css;
  assert.match(css, /\.image-studio \{\s*color: #e2e8f0/);
  assert.match(css, /\.global-progress-stack \.lr-sync-bar__label \{\s*color: #e2e8f0/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /object-fit: contain/);
  const Progress = load('../src/components/GlobalProgressBar.tsx', { '../styles/LightRagSyncBar.scss': {} }).default;
  assert.match(renderToStaticMarkup(React.createElement(Progress, { busy: true }, 'Generating…')), /lr-sync-bar__fill--animated/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Progress, { busy: false }, 'Review')), /lr-sync-bar__fill--animated/);
});
