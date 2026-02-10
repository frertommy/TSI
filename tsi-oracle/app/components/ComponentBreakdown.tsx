interface ComponentBreakdownProps {
  elo: number;
  tsiDisplay: number;
}

export default function ComponentBreakdown({ elo, tsiDisplay }: ComponentBreakdownProps) {
  const rows = [
    { label: 'Base Elo', value: Math.round(elo).toString(), active: true },
    { label: 'Injury Adj', value: '0', active: false },
    { label: 'Transfer Adj', value: '0', active: false },
    { label: 'Manager Adj', value: '0', active: false },
    { label: 'Fatigue Adj', value: '0', active: false },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
        Component Breakdown
      </h2>
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
        <table className="w-full">
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-[var(--card-border)]/50 last:border-b-0"
              >
                <td className="px-4 py-2.5 text-sm text-[var(--text-muted)]">
                  {row.label}
                  {!row.active && (
                    <span className="ml-2 text-xs text-[var(--text-dim)]">(coming soon)</span>
                  )}
                </td>
                <td
                  className={`px-4 py-2.5 text-sm text-right tabular-nums ${
                    row.active ? 'text-[var(--foreground)] font-medium' : 'text-[var(--text-dim)]'
                  }`}
                >
                  {row.value}
                </td>
              </tr>
            ))}
            {/* Separator */}
            <tr className="border-t-2 border-[var(--card-border)]">
              <td className="px-4 py-2.5 text-sm font-semibold text-[var(--foreground)]">
                Total TSI Raw
              </td>
              <td className="px-4 py-2.5 text-sm text-right tabular-nums font-semibold text-[var(--foreground)]">
                {Math.round(elo)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 text-sm font-bold text-[var(--accent-cyan)]">
                TSI Display
              </td>
              <td className="px-4 py-2.5 text-sm text-right tabular-nums font-bold text-[var(--accent-cyan)]">
                {Math.round(tsiDisplay)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--text-dim)]">
        T1 adjustments (injuries, transfers, manager, fatigue) will be activated in a future update.
      </p>
    </div>
  );
}
