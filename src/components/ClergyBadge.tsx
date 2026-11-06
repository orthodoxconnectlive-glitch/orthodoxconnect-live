import React from 'react';
import { Shield } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// Clergy badge (2026-11-05): gold pill with a shield, same style as the
// parish-chat badge. Renders nothing unless the role is clergy.
export function ClergyBadge({ role }: { role?: string | null }) {
  const { t } = useTheme();
  if (String(role || '').toLowerCase() !== 'clergy') return null;
  return (
    <span className="px-1.5 py-0.5 rounded bg-amber-600 text-stone-950 text-[9px] font-black uppercase inline-flex items-center gap-0.5 shrink-0">
      <Shield className="w-2.5 h-2.5" /> {t('clergy')}
    </span>
  );
}
