'use client';

import { useState } from 'react';
import Icon from '@/src/components/shared/Icon/Icon';
import SearchModal from '@/src/components/shared/SearchModal/SearchModal';

/**
 * Search field for the competition page, mirroring the one at the top of the
 * home page: a click/Enter target that opens the shared SearchModal (teams +
 * competitions). The competition page is a Server Component, so this small
 * client island owns the open state and the modal.
 */
export default function CompetitionSearch() {
  const [show, setShow] = useState(false);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setShow(true)}
        onKeyDown={(e) => { if (e.key === 'Enter') setShow(true); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 14px',
          height: 38,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          cursor: 'text',
          marginBottom: 20,
        }}
      >
        <Icon name="search" size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>Search teams, competitions…</span>
      </div>
      {show && <SearchModal locale="en" onClose={() => setShow(false)} />}
    </>
  );
}
