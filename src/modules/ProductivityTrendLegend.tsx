type ProductivityTrendLegendProps = {
  mile: string;
};

export function ProductivityTrendLegend({ mile }: ProductivityTrendLegendProps) {
  return (
    <div className="productivity-chart-legend combo-legend">
      <span><i className="volume"/>Volume Paket {mile}</span>
      <span><i className="manpower"/>Manpower {mile}</span>
      <span><i className="actual"/>Productivity</span>
    </div>
  );
}
