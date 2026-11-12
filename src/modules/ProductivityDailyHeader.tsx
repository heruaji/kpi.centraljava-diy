type ProductivityDailyHeaderProps = {
  title?: string;
  orderLabel?: string;
};

export function ProductivityDailyHeader({
  title = 'Productivity per Tanggal',
  orderLabel = 'Terbaru → terlama',
}: ProductivityDailyHeaderProps) {
  return (
    <>
      <div>
        <span>DAILY PERFORMANCE</span>
        <strong>{title}</strong>
      </div>
      <small>{orderLabel}</small>
    </>
  );
}
