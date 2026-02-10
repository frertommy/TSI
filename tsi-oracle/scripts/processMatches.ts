import { processMatch } from '../lib/tsi/elo';
import { toDisplay } from '../lib/tsi/mapping';
import { CompetitionType, MatchInput } from '../lib/tsi/types';
import {
  APIMatch,
  TeamInfo,
  HistoryEntry,
  CurrentTeamRating,
  Top10Entry,
  BASE_ELO,
  LEAGUES,
  sortMatchesByDate,
  getLeagueCountry,
} from './utils';
import { FetchResult } from './fetchMatches';

/** Map API competition code to CompetitionType */
function toCompetitionType(_code: string): CompetitionType {
  // All 5 leagues map to 'league'
  return CompetitionType.League;
}

/** Determine result from perspective of a team */
function getResult(goalsFor: number, goalsAgainst: number): 'W' | 'D' | 'L' {
  if (goalsFor > goalsAgainst) return 'W';
  if (goalsFor < goalsAgainst) return 'L';
  return 'D';
}

export interface ProcessingOutput {
  teams: TeamInfo[];
  current: CurrentTeamRating[];
  history: Record<string, HistoryEntry[]>;
  top10: Top10Entry[];
  totalMatches: number;
  skippedMatches: number;
  dateRange: { first: string; last: string };
}

export function processAllMatches(fetchResults: FetchResult[]): ProcessingOutput {
  // Step 2: Build team registry
  const teamMap = new Map<number, TeamInfo>();
  // Track which league a team first appeared in
  const teamLeagueMap = new Map<number, string>();

  // Collect all matches from all fetch results
  const allMatches: APIMatch[] = [];

  for (const result of fetchResults) {
    for (const match of result.matches) {
      allMatches.push(match);

      // Register teams
      for (const team of [match.homeTeam, match.awayTeam]) {
        if (!teamMap.has(team.id)) {
          const leagueInfo = LEAGUES.find(l => l.code === result.leagueCode);
          teamMap.set(team.id, {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            league: result.leagueCode,
            country: leagueInfo?.country ?? getLeagueCountry(result.leagueCode),
          });
          teamLeagueMap.set(team.id, result.leagueCode);
        }
      }
    }
  }

  console.log(`  Teams found: ${teamMap.size}`);

  // Step 3: Initialize all teams at base Elo
  const ratings = new Map<number, number>();
  teamMap.forEach((_info, teamId) => {
    ratings.set(teamId, BASE_ELO);
  });

  // Step 4: Process all matches chronologically
  const sorted = sortMatchesByDate(allMatches);
  const history: Record<string, HistoryEntry[]> = {};
  const matchCounts = new Map<number, number>();
  const lastMatchDates = new Map<number, string>();
  const last5Results = new Map<number, ('W' | 'D' | 'L')[]>();
  let skippedMatches = 0;

  // Initialize history arrays
  teamMap.forEach((_info, teamId) => {
    history[String(teamId)] = [];
    matchCounts.set(teamId, 0);
    last5Results.set(teamId, []);
  });

  for (const match of sorted) {
    const homeGoals = match.score.fullTime.home;
    const awayGoals = match.score.fullTime.away;

    // Skip matches with null scores
    if (homeGoals === null || awayGoals === null) {
      skippedMatches++;
      continue;
    }

    const homeId = match.homeTeam.id;
    const awayId = match.awayTeam.id;

    // Auto-register teams that appear but weren't in registry
    if (!ratings.has(homeId)) {
      ratings.set(homeId, BASE_ELO);
      teamMap.set(homeId, {
        id: homeId,
        name: match.homeTeam.name,
        shortName: match.homeTeam.shortName,
        league: match.competition.code,
        country: getLeagueCountry(match.competition.code),
      });
      history[String(homeId)] = [];
      matchCounts.set(homeId, 0);
      last5Results.set(homeId, []);
    }
    if (!ratings.has(awayId)) {
      ratings.set(awayId, BASE_ELO);
      teamMap.set(awayId, {
        id: awayId,
        name: match.awayTeam.name,
        shortName: match.awayTeam.shortName,
        league: match.competition.code,
        country: getLeagueCountry(match.competition.code),
      });
      history[String(awayId)] = [];
      matchCounts.set(awayId, 0);
      last5Results.set(awayId, []);
    }

    const homeRating = ratings.get(homeId)!;
    const awayRating = ratings.get(awayId)!;

    const input: MatchInput = {
      homeRating,
      awayRating,
      homeGoals,
      awayGoals,
      competitionType: toCompetitionType(match.competition.code),
      isNeutralVenue: false,
    };

    const result = processMatch(input);

    // Update ratings
    ratings.set(homeId, result.homeNewRating);
    ratings.set(awayId, result.awayNewRating);

    // Update match counts
    matchCounts.set(homeId, (matchCounts.get(homeId) ?? 0) + 1);
    matchCounts.set(awayId, (matchCounts.get(awayId) ?? 0) + 1);

    // Update last match dates
    const matchDate = match.utcDate.slice(0, 10);
    lastMatchDates.set(homeId, matchDate);
    lastMatchDates.set(awayId, matchDate);

    // Update last 5 results
    const homeResult = getResult(homeGoals, awayGoals);
    const awayResult = getResult(awayGoals, homeGoals);

    const homeLast5 = last5Results.get(homeId)!;
    homeLast5.push(homeResult);
    if (homeLast5.length > 5) homeLast5.shift();

    const awayLast5 = last5Results.get(awayId)!;
    awayLast5.push(awayResult);
    if (awayLast5.length > 5) awayLast5.shift();

    // Record history
    history[String(homeId)].push({
      date: matchDate,
      tsiRaw: Math.round(result.homeNewRating * 100) / 100,
      tsiDisplay: Math.round(toDisplay(result.homeNewRating)),
      delta: Math.round(result.homeDelta * 100) / 100,
      opponent: match.awayTeam.shortName,
      result: homeResult,
      goalsFor: homeGoals,
      goalsAgainst: awayGoals,
      matchId: match.id,
    });

    history[String(awayId)].push({
      date: matchDate,
      tsiRaw: Math.round(result.awayNewRating * 100) / 100,
      tsiDisplay: Math.round(toDisplay(result.awayNewRating)),
      delta: Math.round(result.awayDelta * 100) / 100,
      opponent: match.homeTeam.shortName,
      result: awayResult,
      goalsFor: awayGoals,
      goalsAgainst: homeGoals,
      matchId: match.id,
    });
  }

  const processedCount = sorted.length - skippedMatches;
  const firstDate = sorted.length > 0 ? sorted[0].utcDate.slice(0, 10) : 'N/A';
  const lastDate = sorted.length > 0 ? sorted[sorted.length - 1].utcDate.slice(0, 10) : 'N/A';

  // Step 5: Generate output

  // Calculate form (points from last 5 / 15)
  function calcForm(results: ('W' | 'D' | 'L')[]): number {
    if (results.length === 0) return 0;
    let points = 0;
    for (const r of results) {
      if (r === 'W') points += 3;
      else if (r === 'D') points += 1;
    }
    return Math.round((points / 15) * 100) / 100;
  }

  // Build current ratings
  const currentList: CurrentTeamRating[] = [];
  ratings.forEach((rating, teamId) => {
    const team = teamMap.get(teamId)!;
    const count = matchCounts.get(teamId) ?? 0;
    const l5 = last5Results.get(teamId) ?? [];

    currentList.push({
      id: teamId,
      name: team.name,
      shortName: team.shortName,
      league: team.league,
      tsiRaw: Math.round(rating * 100) / 100,
      tsiDisplay: Math.round(toDisplay(rating)),
      rank: 0, // assigned after sort
      matchesProcessed: count,
      lastMatchDate: lastMatchDates.get(teamId) ?? 'N/A',
      last5: [...l5],
      form: calcForm(l5),
    });
  });

  // Sort by tsiRaw descending and assign ranks
  currentList.sort((a, b) => b.tsiRaw - a.tsiRaw);
  currentList.forEach((team, i) => {
    team.rank = i + 1;
  });

  // Build top 10
  const top10: Top10Entry[] = currentList.slice(0, 10).map(t => ({
    rank: t.rank,
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    league: t.league,
    tsiDisplay: t.tsiDisplay,
    tsiRaw: t.tsiRaw,
  }));

  // Build teams list
  const teams = Array.from(teamMap.values());

  return {
    teams,
    current: currentList,
    history,
    top10,
    totalMatches: processedCount,
    skippedMatches,
    dateRange: { first: firstDate, last: lastDate },
  };
}
