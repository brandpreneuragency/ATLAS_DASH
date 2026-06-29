interface TagChipsProps {
  tags: string[];
  /** Max chips to render before showing "+N". */
  max?: number;
  size?: 'sm' | 'xs';
}

export function TagChips({ tags, max = 4, size = 'xs' }: TagChipsProps) {
  if (!tags || tags.length === 0) return null;
  const shown = tags.slice(0, max);
  const overflow = tags.length - shown.length;
  return (
    <span className={`crm-tag-chips crm-tag-chips--${size}`}>
      {shown.map((tag) => (
        <span key={tag} className="crm-tag-chip">
          {tag}
        </span>
      ))}
      {overflow > 0 && <span className="crm-tag-chip crm-tag-chip--more">+{overflow}</span>}
    </span>
  );
}
