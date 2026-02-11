import React from "react";

type Step = { title: string; body: string };

const steps: Step[] = [
  {
    title: "Mapping",
    body: "Define a deterministic monotonic function x → p ∈ [0,1] (often log-return + sigmoid/tanh). This keeps the market tradable without pinning at 0 or 1.",
  },
  {
    title: "Partial resolution",
    body: "On each oracle print, the clearinghouse settles PnL vs the new anchor p_settle and resets basis — equivalent to closing at the old anchor and reopening at the new anchor.",
  },
  {
    title: "Re-center window (optional)",
    body: "A short 30–120s window where arbers trade against a constrained band around the print, pulling the tradable mark back toward oracle via competition.",
  },
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
      {children}
    </span>
  );
}

function SectionTitle({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      {kicker ? (
        <div className="mb-2 text-xs font-semibold tracking-wider text-slate-500">{kicker}</div>
      ) : null}
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      {subtitle ? <p className="mt-2 max-w-3xl text-slate-600">{subtitle}</p> : null}
    </div>
  );
}

function Card({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "soft";
}) {
  const base =
    "rounded-2xl border shadow-sm backdrop-blur-sm transition-all";
  const toneCls =
    tone === "soft"
      ? "border-slate-200 bg-slate-50"
      : "border-slate-200 bg-white";
  return (
    <div className={`${base} ${toneCls}`}>
      <div className="p-6">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-3 text-sm leading-relaxed text-slate-600">{children}</div>
      </div>
    </div>
  );
}

function ArchitectureDiagram() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">Architecture</div>
        <div className="flex flex-wrap gap-2">
          <Chip>Oracle prints</Chip>
          <Chip>Solana PDAs</Chip>
          <Chip>CLOB trading</Chip>
          <Chip>Lazy settlement</Chip>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <svg
          viewBox="0 0 1100 780"
          className="w-full h-[560px] sm:h-[640px] lg:h-[720px]"
          role="img"
          aria-label="Architecture: top data+oracle; mid clearinghouse; bottom apps+clob with clean gutters"
        >
          <defs>
            <linearGradient id="box" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F8FAFC" />
              <stop offset="1" stopColor="#FFFFFF" />
            </linearGradient>

            <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1" fill="#E2E8F0" />
            </pattern>

            <marker id="arrowBlue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563EB" />
            </marker>
            <marker id="arrowGray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
            </marker>
            <marker id="arrowCyan" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#06B6D4" />
            </marker>

            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.10" />
            </filter>
          </defs>

          {/* background */}
          <rect x="10" y="10" width="1080" height="760" rx="26" ry="26" fill="url(#dots)" opacity="0.55" />

          {/* ===================== TOP ROW ===================== */}
          <g filter="url(#soft)">
            {/* Data sources */}
            <rect x="80" y="70" rx="24" ry="24" width="360" height="120" fill="url(#box)" stroke="#E2E8F0" />
            <text x="110" y="112" fontSize="18" fontWeight="700" fill="#0F172A">Data sources</text>
            <text x="110" y="142" fontSize="14" fill="#334155">ETFs, indices, volumes, trends</text>

            {/* Oracle adapter */}
            <rect x="500" y="70" rx="24" ry="24" width="360" height="120" fill="url(#box)" stroke="#E2E8F0" />
            <text x="530" y="112" fontSize="18" fontWeight="700" fill="#0F172A">Oracle adapter</text>
            <text x="530" y="142" fontSize="14" fill="#334155">Mapping x → p • Signed prints</text>
          </g>

          {/* Data -> Oracle (top gutter lane) */}
          <path d="M 440 130 L 500 130" stroke="#94A3B8" strokeWidth="3" fill="none" markerEnd="url(#arrowGray)" />

          {/* ===================== MID ROW ===================== */}
          <g filter="url(#soft)">
            <rect x="240" y="260" rx="28" ry="28" width="620" height="260" fill="#F8FAFC" stroke="#E2E8F0" />
            <text x="276" y="306" fontSize="18" fontWeight="700" fill="#0F172A">Clearinghouse (Solana / Anchor)</text>
            <text x="276" y="334" fontSize="13" fill="#64748B">Settles PnL to prints • Margin + liquidations</text>

            {/* Inner PDAs */}
            <rect x="276" y="362" rx="18" ry="18" width="230" height="72" fill="#FFFFFF" stroke="#E2E8F0" />
            <text x="300" y="395" fontSize="13" fontWeight="700" fill="#0F172A">Market PDA</text>
            <text x="300" y="417" fontSize="12" fill="#334155">p_settle, params</text>

            <rect x="530" y="362" rx="18" ry="18" width="300" height="72" fill="#FFFFFF" stroke="#E2E8F0" />
            <text x="554" y="395" fontSize="13" fontWeight="700" fill="#0F172A">Vault PDA</text>
            <text x="554" y="417" fontSize="12" fill="#334155">USDC collateral</text>

            <rect x="276" y="448" rx="18" ry="18" width="230" height="72" fill="#FFFFFF" stroke="#E2E8F0" />
            <text x="300" y="481" fontSize="13" fontWeight="700" fill="#0F172A">Position PDAs</text>
            <text x="300" y="503" fontSize="12" fill="#334155">size, margin, lazy settle</text>

            <rect x="530" y="448" rx="18" ry="18" width="300" height="72" fill="#FFFFFF" stroke="#E2E8F0" />
            <text x="554" y="481" fontSize="13" fontWeight="700" fill="#0F172A">Insurance</text>
            <text x="554" y="503" fontSize="12" fill="#334155">bad debt backstop</text>
          </g>

          {/* Oracle -> Clearinghouse (vertical gutter) */}
          <path
            d="M 680 190 L 680 230 L 550 230 L 550 260"
            stroke="#2563EB"
            strokeWidth="3"
            fill="none"
            markerEnd="url(#arrowBlue)"
          />
          <g>
            <rect x="574" y="202" rx="12" ry="12" width="230" height="26" fill="#FFFFFF" stroke="#E2E8F0" />
            <text x="586" y="221" fontSize="12" fontWeight="700" fill="#2563EB">publish_print(p_oracle)</text>
          </g>

          {/* ===================== BOTTOM ROW ===================== */}
          <g filter="url(#soft)">
            {/* Apps */}
            <rect x="80" y="590" rx="28" ry="28" width="520" height="150" fill="url(#box)" stroke="#E2E8F0" />
            <text x="110" y="640" fontSize="18" fontWeight="700" fill="#0F172A">Apps</text>
            <text x="110" y="672" fontSize="14" fill="#334155">Retail mobile + Pro desktop</text>
            <text x="110" y="698" fontSize="14" fill="#334155">Create orders, view positions</text>

            {/* CLOB */}
            <rect x="640" y="600" rx="24" ry="24" width="380" height="140" fill="url(#box)" stroke="#E2E8F0" />
            <text x="668" y="646" fontSize="15" fontWeight="700" fill="#0F172A">CLOB / matcher</text>
            <text x="668" y="670" fontSize="13" fill="#334155">apply_fill()</text>
            <text x="668" y="698" fontSize="12" fill="#64748B">user-vs-user fills</text>
          </g>

          {/* Apps -> CLOB (bottom gutter lane) */}
          <path
            d="M 600 670 L 640 670"
            stroke="#94A3B8"
            strokeWidth="3"
            fill="none"
            markerEnd="url(#arrowGray)"
          />
          <g>
            <rect x="606" y="642" rx="12" ry="12" width="64" height="24" fill="#FFFFFF" stroke="#E2E8F0" />
            <text x="620" y="659" fontSize="12" fill="#64748B">orders</text>
          </g>

          {/* CLOB -> Clearinghouse (vertical lane x=830) */}
          <path
            d="M 830 600 L 830 520"
            stroke="#2563EB"
            strokeWidth="3"
            fill="none"
            markerEnd="url(#arrowBlue)"
          />
          <g>
            <rect x="844" y="542" rx="12" ry="12" width="86" height="24" fill="#FFFFFF" stroke="#E2E8F0" />
            <text x="856" y="559" fontSize="12" fontWeight="700" fill="#2563EB">apply_fill</text>
          </g>

          {/* Clearinghouse -> Apps (state back) straight down */}
          <path
            d="M 550 520 L 550 590"
            stroke="#94A3B8"
            strokeWidth="3"
            fill="none"
            strokeDasharray="7 7"
            markerEnd="url(#arrowGray)"
          />
          <g>
            <rect x="566" y="536" rx="12" ry="12" width="142" height="24" fill="#FFFFFF" stroke="#E2E8F0" />
            <text x="578" y="553" fontSize="12" fill="#64748B">positions, equity</text>
          </g>

          {/* tiny lane labels */}
          <text x="80" y="240" fontSize="11" fill="#94A3B8">oracle lane</text>
          <text x="80" y="572" fontSize="11" fill="#94A3B8">trade lane</text>
        </svg>

        <div className="mt-4 text-xs text-slate-500">
          Lazy settlement: positions realize PnL when touched (trade / withdraw / liquidate), so prints scale to many users.
        </div>
      </div>
    </div>
  );
}

function MiniChart() {
  return (
    <svg viewBox="0 0 240 80" className="h-20 w-full" aria-label="Mini price chart">
      <polyline
        fill="none"
        stroke="#2563EB"
        strokeWidth="3"
        points="0,58 20,54 40,60 60,44 80,48 100,36 120,40 140,26 160,32 180,18 200,24 220,14 240,20"
      />
      <line x1="0" y1="70" x2="240" y2="70" stroke="#E2E8F0" />
    </svg>
  );
}

export default function LongTailMarketsExplainerSite() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-xs font-bold text-white">O</div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Oddball</div>
              <div className="text-xs text-slate-500">Long-tail markets</div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto max-w-6xl px-6 pt-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Chip>Bounded mapping</Chip>
                <Chip>Partial resolution</Chip>
                <Chip>Solana PDAs</Chip>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Tradeable Long-Tail Markets
              </h1>
              <p className="mt-3 max-w-2xl text-slate-600">
                Make niche markets continuously tradeable using a bounded price mapping (p ∈ [0,1]) and perp-style
                settlement (partial resolution) at each oracle print.
              </p>
              <div className="mt-4 text-sm text-slate-500">February 10, 2026</div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {["Cheap to list", "Bounded risk", "Continuous signal", "User-vs-user PnL"].map((t) => (
                <div key={t} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Problem / Solution */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card title="Problem">
            Perps avoid long-tail underlyings because listing overhead is high and marks are fragile without deep spot liquidity.
            <br />
            <br />
            Many interesting markets are not tradable assets at all (indices, volumes, attention, culture metrics).
          </Card>
          <Card title="Solution">
            Turn any measurable signal into a bounded price <span className="font-semibold text-slate-800">p ∈ [0,1]</span>, then settle PnL to the oracle
            print so positions stay live.
            <br />
            <br />
            Cheap listing, bounded risk, real price discovery — no spot market required.
          </Card>
        </div>

        {/* How it works */}
        <div className="mt-12">
          <SectionTitle
            kicker="MECHANISM"
            title="How it works"
            subtitle="Three pieces: a mapping to keep price bounded, a settlement process to anchor to oracle prints, and an optional re-center window to keep the tradable mark tight."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
                  {i + 1}
                </div>
                <div className="text-base font-semibold text-slate-900">{s.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="text-sm font-semibold text-slate-900">Why this makes long-tail tradeable</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                { k: "Bounded risk", v: "Price is capped in [0,1], simplifying margin and solvency." },
                { k: "Low listing overhead", v: "New market = mapping spec + oracle feed + parameters." },
                { k: "Price discovery", v: "Continuous signal even when the underlying isn't spot-tradable." },
                { k: "Zero-sum clearing", v: "PnL transfers between users; protocol earns explicit fees." },
              ].map((b) => (
                <div key={b.k} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">{b.k}</div>
                  <div className="mt-1 text-sm text-slate-600">{b.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Architecture */}
        <div className="mt-12">
          <SectionTitle
            kicker="ARCHITECTURE"
            title="Low-overhead listing and scalable settlement"
            subtitle="This diagram mirrors the 2-pager: clean flow, minimal arrows, and explicit instructions for the key interactions."
          />
          <ArchitectureDiagram />
        </div>

        {/* Example */}
        <div className="mt-12 pb-16">
          <SectionTitle
            kicker="EXAMPLE"
            title="Betting on the Collectibles market"
            subtitle="A concrete visual: market card + trade ticket. The exact same concept applies to sector ETFs, culture indices, attention metrics, etc."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Polymarket-style market card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Will the Collectibles Trade Volume grow?</div>
                  <div className="mt-1 text-xs text-slate-500">Oracle: monthly print • mapped price p ∈ [0,1]</div>
                </div>
                <Chip>Collectibles</Chip>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="text-xs font-semibold text-blue-700">YES</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">57%</div>
                  <div className="mt-1 text-xs text-slate-500">Price: 0.57</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold text-slate-700">NO</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">43%</div>
                  <div className="mt-1 text-xs text-slate-500">Price: 0.43</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <MiniChart />
              </div>

              {/* Where 57% comes from */}
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold tracking-wide text-slate-500">WHERE 57% COMES FROM</div>
                <div className="mt-2 grid gap-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Current collectibles volume (oracle)</span>
                    <span className="font-semibold">$12.4B</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Range (min → max)</span>
                    <span className="font-semibold">$5.0B → $20.0B</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Normalization</span>
                    <span className="font-semibold">p = (x − min) / (max − min)</span>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Example: p = (12.4 − 5.0) / (20.0 − 5.0) ≈ <span className="font-semibold text-slate-800">0.49</span> → then mapped/smoothed to <span className="font-semibold text-slate-800">0.57</span> via the market's mapping function.
                </div>
                <div className="mt-2 text-xs text-slate-500">(Numbers shown are illustrative — each market publishes its bounds + mapping spec.)</div>
              </div>

              <div className="mt-4 text-sm text-slate-600">
                Interpretation: <span className="font-semibold text-slate-800">57%</span> is the current mapped price (p). At each oracle print, the clearinghouse
                settles PnL to the new p and trading continues.
              </div>
            </div>

            {/* Polymarket-style ticket (YES/NO + USDC only) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Buy shares</div>
              <div className="mt-1 text-xs text-slate-500">USDC in • YES/NO shares out • settlement at each oracle print</div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm">YES</button>
                <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm">NO</button>
              </div>

              <div className="mt-5">
                <div className="text-xs font-semibold text-slate-500">Amount (USDC)</div>
                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">150</div>
              </div>

              {/* Pricing transparency */}
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold tracking-wide text-slate-500">PRICE TRANSPARENCY</div>
                <div className="mt-2 text-sm text-slate-600">
                  The displayed <span className="font-semibold text-slate-800">57%</span> is a bounded price derived from the oracle's current value x and the
                  market's published bounds (min/max). This makes the market listable even when there's no spot asset.
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Inputs: x (oracle), min/max bounds, mapping function → output: p ∈ [0,1].
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">YES price</span>
                  <span className="font-semibold">0.57</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                  <span>Est. shares</span>
                  <span className="font-semibold">~263</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">Example: if next print moves to 0.60 → PnL ≈ shares × (0.60 − 0.57)</div>
              </div>

              <button className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm">BUY YES</button>

              <div className="mt-4 text-xs text-slate-500">No leverage, no funding — just a bounded price and print-based settlement.</div>
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">What you should take away</div>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>We can list long-tail markets cheaply by specifying a mapping + an oracle feed — not by bootstrapping a spot market.</li>
              <li>Partial resolution makes positions behave like perps: PnL is realized to the latest print while trading stays continuous.</li>
              <li>Economically, settlement is user-vs-user (zero-sum) except explicit protocol fees.</li>
            </ul>
          </div>

          {/* Business potential */}
          <div className="mt-12">
            <SectionTitle
              kicker="BUSINESS"
              title="Why this has strong business potential"
              subtitle="This isn't just a mechanism — it unlocks a scalable listing + distribution model that most perp venues can't touch."
            />

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Infinite catalog</div>
                <div className="mt-2 text-sm text-slate-600">
                  Listing cost drops to: <span className="font-semibold text-slate-800">mapping + oracle print</span>. That means you can ship hundreds of niche markets
                  and let demand pick winners (instead of paying for each listing).
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">A new distribution wedge</div>
                <div className="mt-2 text-sm text-slate-600">
                  Each market is a community-sized product (collectibles, vertical ETFs, culture indices). That makes GTM modular: partner with creators, forums,
                  and vertical apps around a specific market, not "trading in general".
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Cleaner risk + ops</div>
                <div className="mt-2 text-sm text-slate-600">
                  Bounded price + print-based settlement simplifies solvency: worst-case moves are known and prints reset basis. That reduces tail-risk compared to
                  unbounded synthetics.
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Multiple revenue lines (without hidden games)</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />Trading fees on user-vs-user volume (primary).</li>
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />Market creation / curation fees for premium feeds.</li>
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />B2B: white-label the clearinghouse + mapping/oracle stack to other venues.</li>
                </ul>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Network effects you can actually compound</div>
                <div className="mt-2 text-sm text-slate-600">
                  The more markets you list, the more standardized your "market spec" becomes (mappings, parameter templates, oracle adapters). That grows a reusable
                  library — and makes future markets faster to launch and easier for traders to understand.
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">The compounding loop:</span> ship markets → discover demand → deepen liquidity on winners → improve specs → ship even more markets.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
