import React, { useState } from 'react';

type Item = {
  title: string;
  content: React.ReactNode;
};

type Props = {
  items: Item[];
  defaultOpenIndex?: number; // -1 = none
};

const Accordion: React.FC<Props> = ({ items, defaultOpenIndex = -1 }) => {
  const [openIndex, setOpenIndex] = useState<number>(defaultOpenIndex);

  const toggle = (i: number) => {
    setOpenIndex(prev => (prev === i ? -1 : i)); // only one open at a time
  };

  return (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{ borderBottom: '1px solid #eee', padding: '12px 0' }}>
          <button
            onClick={() => toggle(i)}
            aria-expanded={openIndex === i}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              alignItems: 'center',
            }}
          >
            <span>{it.title}</span>
            <span style={{ fontSize: 20 }}>{openIndex === i ? '−' : '+'}</span>
          </button>
          {openIndex === i && <div style={{ marginTop: 8, color: '#333' }}>{it.content}</div>}
        </div>
      ))}
    </div>
  );
};

export default Accordion;
