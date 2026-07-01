import { useState, useRef, useEffect, useCallback } from 'react';

interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

export function Dropdown({ options, value, onChange, placeholder, className, 'aria-label': ariaLabel }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[highlightedIndex] as HTMLElement;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen) {
        onChange(options[highlightedIndex].value);
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) { setIsOpen(true); return; }
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [isOpen, options, highlightedIndex, onChange]);

  return (
    <div className={`dropdown ${className || ''}`} ref={containerRef} aria-label={ariaLabel}>
      <button
        className="dropdown__trigger"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        type="button"
      >
        {selectedOption?.icon && <span className="dropdown__trigger-icon">{selectedOption.icon}</span>}
        <span className="dropdown__trigger-text">{selectedOption?.label || placeholder || 'Select...'}</span>
        <svg className="dropdown__chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isOpen && (
        <div className="dropdown__menu" role="listbox" ref={listRef}>
          {options.map((option, i) => (
            <button
              key={option.value}
              className={`dropdown__item ${option.value === value ? 'dropdown__item--selected' : ''} ${i === highlightedIndex ? 'dropdown__item--highlighted' : ''}`}
              onClick={() => { onChange(option.value); setIsOpen(false); }}
              role="option"
              aria-selected={option.value === value}
            >
              {option.icon && <span className="dropdown__item-icon">{option.icon}</span>}
              <span className="dropdown__item-label">{option.label}</span>
              {option.value === value && (
                <svg className="dropdown__check" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
