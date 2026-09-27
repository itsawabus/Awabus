/**
 * The row between a list page's summary cards and its table: something on the
 * left (a count or filter tabs) and the page's actions on the right
 * (Select, Bulk upload, Add ...).
 */
export default function ListToolbar({ left, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">{left}</div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">{children}</div>
    </div>
  );
}
