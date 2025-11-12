import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import Api from '../Api';
import { Page } from '../types';
import '../styles/PagePicker.scss';

Modal.setAppElement('#root');

export type PagePickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (page: Page) => void;
  placeholder?: string;
  /**
   * Filter pages by a single type (server-side) or multiple types (client-side).
   * If both filterType and filterTypes are omitted or set to 'any', all types are shown.
   */
  filterType?: Page['type'] | 'any';
  filterTypes?: Array<Page['type']>;
};

const typeIcon = (t: Page['type']) => {
  switch (t) {
    case 'campaign':
      return <i className="icon icli iconly-Calendar" />;
    case 'place':
      return <i className="icon icli iconly-Location" />;
    case 'people':
      return <i className="icon icli iconly-User" />;
    case 'myth':
      return <i className="icon icli iconly-Discovery" />;
    case 'history':
    default:
      return <i className="icon icli iconly-Paper" />;
  }
};

const PagePickerModal: React.FC<PagePickerModalProps> = ({ isOpen, onClose, onSelect, placeholder = 'Search pages…', filterType = 'any', filterTypes }) => {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = async (q: string) => {
    setLoading(true);
    try {
      // If multiple filter types are provided, perform a broad search and filter client-side.
      if (filterTypes && filterTypes.length > 0) {
        const pages = await Api.searchPages(q, undefined, 50);
        setItems(pages.filter((p) => filterTypes.includes(p.type)));
      } else {
        const pages = await Api.searchPages(q, filterType === 'any' ? undefined : filterType, 50);
        setItems(pages);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void doSearch('');
  }, [isOpen]);

  useEffect(() => {
    const h = setTimeout(() => void doSearch(query.trim()), 200);
    return () => clearTimeout(h);
  }, [query]);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Link a Page"
      overlayClassName="modal__overlay"
      className="modal__content modal__content--page-picker"
    >
      <div className="page-picker">
        <div className="page-picker__header">
          <h3>Pages</h3>
          {loading && <span className="page-picker__loading">Loading…</span>}
        </div>
        <input
          className="page-picker__search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="page-picker__list">
          {items.length === 0 && !loading && (
            <div className="page-picker__empty">No pages found</div>
          )}
          {items.map((p) => (
            <button
              key={p._id}
              type="button"
              className="page-picker__item"
              onClick={() => {
                onSelect(p);
                onClose();
              }}
            >
              <span className="page-picker__icon">{typeIcon(p.type)}</span>
              <span className="page-picker__title">{p.title}</span>
            </button>
          ))}
        </div>
        <div className="page-picker__footer">
          <button type="button" className="btn-muted" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
};

export default PagePickerModal;
