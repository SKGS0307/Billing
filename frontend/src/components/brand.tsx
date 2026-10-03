export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-400/40 bg-gold-400 text-lg font-black text-ink">T</div>
      {!compact && <div><p className="text-sm font-extrabold tracking-[0.18em] text-white">THE TRENDS</p><p className="text-xs font-medium tracking-[0.35em] text-gold-400">MART</p></div>}
    </div>
  );
}
