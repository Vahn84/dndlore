import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoreHome.scss';

/**
 * Landing page for the lore library. Presents the different categories of
 * lore pages that the user can browse. Clicking a category navigates to
 * the list of pages of that type.
 */
const LoreHome: React.FC = () => {
  const navigate = useNavigate();
  // Define the categories available. We include a user‑friendly label
  // and the corresponding type used in the API. A placeholder icon can
  // be replaced with images if desired.
  const categories = [
    { type: 'place', label: 'Places', icon: '🏰' },
    { type: 'history', label: 'History', icon: '📜' },
    { type: 'myth', label: 'Myths', icon: '🐉' },
    { type: 'people', label: 'People', icon: '🧝' },
    { type: 'campaign', label: 'Campaigns', icon: '🎲' },
  ];

  return (
    <div className="loreHome offset-container">
      <h1 className="loreTitle">Lore Library</h1>
      <p className="loreSubtitle">Explore the world of Aetherium through its places, history, myths, people and campaigns.</p>
      <div className="categoryGrid">
        {categories.map(cat => (
          <button
            key={cat.type}
            className="categoryCard"
            onClick={() => navigate(`/lore/${cat.type}`)}
          >
            <div className="icon" aria-hidden>{cat.icon}</div>
            <span className="label">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LoreHome;