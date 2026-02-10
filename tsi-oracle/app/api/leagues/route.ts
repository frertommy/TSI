import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface TeamRow {
  id: string;
  name: string;
  league: string;
  league_name: string;
  current_tsi_display: number;
  current_rank: number;
}

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

export async function GET() {
  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, league, league_name, current_tsi_display, current_rank')
      .order('current_rank', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Group by league
    const leagueMap = new Map<string, {
      code: string;
      name: string;
      teams: { id: string; name: string; tsiDisplay: number; rank: number }[];
    }>();

    for (const t of (teams ?? []) as TeamRow[]) {
      if (!leagueMap.has(t.league)) {
        leagueMap.set(t.league, {
          code: t.league,
          name: t.league_name,
          teams: [],
        });
      }
      leagueMap.get(t.league)!.teams.push({
        id: t.id,
        name: t.name,
        tsiDisplay: Number(t.current_tsi_display),
        rank: Number(t.current_rank),
      });
    }

    const leagues = [...leagueMap.values()]
      .map(l => {
        const totalTsi = l.teams.reduce((s, t) => s + t.tsiDisplay, 0);
        const topTeam = l.teams[0]; // already sorted by rank

        return {
          code: l.code,
          name: l.name,
          teamCount: l.teams.length,
          avgTsiDisplay: Math.round(totalTsi / l.teams.length),
          topTeam: topTeam
            ? { id: topTeam.id, name: topTeam.name, tsiDisplay: topTeam.tsiDisplay }
            : null,
        };
      })
      .sort((a, b) => b.avgTsiDisplay - a.avgTsiDisplay);

    return NextResponse.json({ leagues }, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
