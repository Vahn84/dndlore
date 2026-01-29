import React, { useState } from 'react';

interface CustomDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  zIndex?: number;
  onToggle?: (isOpen: boolean) => void;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  trigger,
  children,
  zIndex = 50,
  onToggle,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    onToggle?.(newIsOpen);
    
    // Set CSS var for max dropdown height based on viewport position
    if (e.currentTarget instanceof HTMLElement) {
      const rect = e.currentTarget.getBoundingClientRect();
      document.documentElement.style.setProperty(
        '--popup-top',
        `${rect.bottom}px`
      );
    }
  };

  return (
    <div
      className="custom-dropdown"
      style={{
        position: 'relative',
        zIndex,
      }}
    >
      <button
        type="button"
        className="dropdown-trigger"
        onClick={handleToggle}
      >
        {trigger}
        <span className="dropdown-arrow">▼</span>
      </button>
      
      {isOpen && (
        <div className="dropdown-popup">
          {children}
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;