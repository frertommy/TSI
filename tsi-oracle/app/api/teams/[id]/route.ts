import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Compute stats from history
    const historyPoints = history ?? [];
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

    const response = {
      team: {
        id: team.id,
        name: team.name,
        league: team.league,
        leagueName: team.league_name,
        elo: team.current_elo,
        tsiDisplay: team.current_tsi_display,
        rank: team.current_rank,
        change7d: team.change_7d,
        changePercent7d: team.change_percent_7d,
      },
      history: historyPoints.map(h => ({
        date: h.date,
        elo: h.elo,
        tsiDisplay: h.tsi_display,
      })),
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
