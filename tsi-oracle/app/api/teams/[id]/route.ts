import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface HistoryRow {
  date: string;
  elo: number;
  tsi_display: number;
}

interface TeamRow {
  id: string;
  name: string;
  league: string;
  league_name: string;
  current_elo: number;
  current_tsi_display: number;
  current_rank: number;
  change_7d: number;
  change_percent_7d: number;
  updated_at: string;
}

interface OptaHistoryPoint {
  date: string;
  optaRating: number;
  optaRank: number;
}

// Load Opta history from JSON file (fallback when opta_daily table doesn't exist)
let optaHistoryCache: Record<string, OptaHistoryPoint[]> | null = null;

function loadOptaHistory(): Record<string, OptaHistoryPoint[]> {
  if (optaHistoryCache) return optaHistoryCache;
  try {
    const filePath = resolve(process.cwd(), 'data', 'opta_history.json');
    optaHistoryCache = JSON.parse(readFileSync(filePath, 'utf-8'));
    return optaHistoryCache!;
  } catch {
    return {};
  }
}

// Load Opta current from JSON file
let optaCurrentCache: Record<string, { optaRating: number; optaRank: number }> | null = null;

function loadOptaCurrent(): Record<string, { optaRating: number; optaRank: number }> {
  if (optaCurrentCache) return optaCurrentCache;
  try {
    const filePath = resolve(process.cwd(), 'data', 'opta_current.json');
    optaCurrentCache = JSON.parse(readFileSync(filePath, 'utf-8'));
    return optaCurrentCache!;
  } catch {
    return {};
  }
}

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const days = parseInt(searchParams.get('days') ?? '365', 10) || 365;

  try {
    // Fetch team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Fetch history (limited by days)
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const sinceDateStr = sinceDate.toISOString().split('T')[0];

    const { data: history, error: histError } = await supabase
      .from('tsi_daily')
      .select('date, elo, tsi_display')
      .eq('team_id', id)
      .gte('date', sinceDateStr)
      .order('date', { ascending: true });

    if (histError) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Compute stats from history — coerce NUMERIC strings to numbers
    const historyPoints = ((history ?? []) as HistoryRow[]).map(h => ({
      date: h.date,
      elo: Number(h.elo),
      tsi_display: Number(h.tsi_display),
    }));
    let peakElo = 0;
    let peakDate = '';
    let lowestElo = Infinity;
    let lowestDate = '';

    for (const h of historyPoints) {
      if (h.elo > peakElo) {
        peakElo = h.elo;
        peakDate = h.date;
      }
      if (h.elo < lowestElo) {
        lowestElo = h.elo;
        lowestDate = h.date;
      }
    }

    // Volatility: stddev of daily tsiDisplay pct changes over last 30 days
    const last30 = historyPoints.slice(-31); // need 31 to get 30 changes
    let volatility30d = 0;
    if (last30.length > 1) {
      const pctChanges: number[] = [];
      for (let i = 1; i < last30.length; i++) {
        const prev = last30[i - 1].tsi_display;
        const curr = last30[i].tsi_display;
        if (prev > 0) {
          pctChanges.push(((curr - prev) / prev) * 100);
        }
      }
      if (pctChanges.length > 0) {
        const mean = pctChanges.reduce((s, v) => s + v, 0) / pctChanges.length;
        const variance = pctChanges.reduce((s, v) => s + (v - mean) ** 2, 0) / pctChanges.length;
        volatility30d = Math.round(Math.sqrt(variance) * 100) / 100;
      }
    }

    // Fetch Opta history: try DB first, fall back to JSON file
    let optaHistory: OptaHistoryPoint[] = [];
    const { data: optaDbData, error: optaDbError } = await supabase
      .from('opta_daily')
      .select('date, opta_rating, opta_rank')
      .eq('team_id', id)
      .gte('date', sinceDateStr)
      .order('date', { ascending: true });

    if (!optaDbError && optaDbData && optaDbData.length > 0) {
      optaHistory = optaDbData.map((r: { date: string; opta_rating: number; opta_rank: number }) => ({
        date: r.date,
        optaRating: Number(r.opta_rating),
        optaRank: Number(r.opta_rank),
      }));
    } else {
      // Fallback to JSON file
      const allOpta = loadOptaHistory();
      const teamOpta = allOpta[id] ?? [];
      optaHistory = teamOpta.filter(p => p.date >= sinceDateStr);
    }

    // Get current Opta data
    const optaCurrent = loadOptaCurrent();
    const currentOpta = optaCurrent[id] ?? null;

    const response = {
      team: {
        id: team.id,
        name: team.name,
        league: team.league,
        leagueName: team.league_name,
        elo: Number(team.current_elo),
        tsiDisplay: Number(team.current_tsi_display),
        rank: Number(team.current_rank),
        change7d: Number(team.change_7d),
        changePercent7d: Number(team.change_percent_7d),
        optaRating: currentOpta?.optaRating ?? null,
        optaRank: currentOpta?.optaRank ?? null,
      },
      history: historyPoints.map(h => ({
        date: h.date,
        elo: h.elo,
        tsiDisplay: h.tsi_display,
      })),
      optaHistory,
      stats: {
        peakElo: peakElo === 0 ? null : peakElo,
        peakDate: peakDate || null,
        lowestElo: lowestElo === Infinity ? null : lowestElo,
        lowestDate: lowestDate || null,
        volatility30d,
      },
    };

    return NextResponse.json(response, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
