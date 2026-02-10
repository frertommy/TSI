import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10) || 10, 100);
  const league = searchParams.get('league');

  try {
    let query = supabase
      .from('teams')
      .select('*')
      .order('current_rank', { ascending: true })
      .limit(limit);

    if (league) {
      query = query.eq('league', league.toUpperCase());
    }

    const { data, error } = await query;
    const teams = (data ?? []) as TeamRow[];

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    // Get total count
    let countQuery = supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });

    if (league) {
      countQuery = countQuery.eq('league', league.toUpperCase());
    }

    const { count } = await countQuery;

    // Find the most recent updated_at
    const latestUpdate = teams.length > 0
      ? teams.reduce((latest: string, t) =>
          t.updated_at > latest ? t.updated_at : latest,
          teams[0].updated_at
        )
      : null;

    const response = {
      teams: teams.map(t => ({
        id: t.id,
        name: t.name,
        league: t.league,
        leagueName: t.league_name,
        elo: Number(t.current_elo),
        tsiDisplay: Number(t.current_tsi_display),
        rank: Number(t.current_rank),
        change7d: Number(t.change_7d),
        changePercent7d: Number(t.change_percent_7d),
      })),
      total: count ?? 0,
      updatedAt: latestUpdate,
    };

    return NextResponse.json(response, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
