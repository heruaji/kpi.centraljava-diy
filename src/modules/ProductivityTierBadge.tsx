type ProductivityTierBadgeProps = {
  tier: string | null | undefined;
};

export function ProductivityTierBadge({ tier }: ProductivityTierBadgeProps) {
  const className = tier?.toLowerCase().replace(' ', '-') ?? '';
  return <span className={`productivity-tier ${className}`}>{tier ?? '—'}</span>;
}
