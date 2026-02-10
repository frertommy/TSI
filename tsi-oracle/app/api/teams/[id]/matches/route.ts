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
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100);

  try {
    // Verify team exists
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Fetch matches where team is home or away
    const { data: homeMatches } = await supabase
      .from('matches')
      .select('*')
      .eq('home_team_id', id)
      .order('date', { ascending: false })
      .limit(limit);

    const { data: awayMatches } = await supabase
      .from('matches')
      .select('*')
      .eq('away_team_id', id)
      .order('date', { ascending: false })
      .limit(limit);

    // Combine and sort
    const allMatches = [
      ...(homeMatches ?? []).map(m => ({
        date: m.date,
        opponent: m.away_team_name,
        isHome: true,
        goalsFor: m.home_goals,
        goalsAgainst: m.away_goals,
        result: m.home_goals > m.away_goals ? 'W' : m.home_goals < m.away_goals ? 'L' : 'D',
      })),
      ...(awayMatches ?? []).map(m => ({
        date: m.date,
        opponent: m.home_team_name,
        isHome: false,
        goalsFor: m.away_goals,
        goalsAgainst: m.home_goals,
        result: m.away_goals > m.home_goals ? 'W' : m.away_goals < m.home_goals ? 'L' : 'D',
      })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);

    const response = {
      matches: allMatches,
      teamId: id,
      total: allMatches.length,
    };

    return NextResponse.json(response, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
