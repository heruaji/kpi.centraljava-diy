type ProductivityTrendHeaderProps = {
  mile: string;
  target: number;
};

export function ProductivityTrendHeader({ mile, target }: ProductivityTrendHeaderProps) {
  return (
    <div className="productivity-daily-head">
      <div>
        <span>PRODUCTIVITY ANALYSIS</span>
        <strong>Volume Paket {mile}, Manpower {mile} & Productivity</strong>
      </div>
      <small>Target Productivity {target}</small>
    </div>
  );
}
