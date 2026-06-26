import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const API_FOOTBALL_URL = "https://v3.football.api-sports.io";
const WORLD_CUP_ID = 1;

async function fetchFromApiSport(endpoint: string): Promise<unknown> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error("API_FOOTBALL_KEY not configured");

  const res = await fetch(`${API_FOOTBALL_URL}${endpoint}`, {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
  });

  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function syncResults() {
  const supabase = createServerClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const eightMinAgo = new Date(now.getTime() - 8 * 60 * 1000);

  const { data: liveMatches } = await supabase
    .from("matches")
    .select("id, updated_at")
    .eq("status", "LIVE");

  if (liveMatches && liveMatches.length > 0) {
    const allRecentlyUpdated = liveMatches.every(
      (m) => m.updated_at && new Date(m.updated_at) > eightMinAgo
    );
    if (allRecentlyUpdated) {
      return {
        message: `Cache: ${liveMatches.length} partidos en vivo actualizados hace menos de 8 min`,
        updated: 0,
        apiCallsUsed: 0,
        status: 200,
      };
    }
  }

  const { data: relevantMatches, error: fetchError } = await supabase
    .from("matches")
    .select("id, fecha_partido, status")
    .or(
      `status.eq.LIVE,and(status.eq.NS,fecha_partido.gte.${todayStart.toISOString()},fecha_partido.lte.${todayEnd.toISOString()})`
    );

  if (fetchError) {
    return { error: fetchError.message, status: 500 };
  }

  if (!relevantMatches || relevantMatches.length === 0) {
    return {
      message: "No hay partidos relevantes para actualizar",
      updated: 0,
      apiCallsUsed: 0,
      status: 200,
    };
  }

  const hasLiveMatches = relevantMatches.some((m) => m.status === "LIVE");
  if (!hasLiveMatches) {
    const allNS = relevantMatches.filter((m) => m.status === "NS");
    const allFuture = allNS.every(
      (m) => new Date(m.fecha_partido) > new Date(now.getTime() + 2 * 60 * 60 * 1000)
    );
    if (allFuture) {
      return {
        message: `Hay ${allNS.length} partidos hoy pero ninguno empieza en las proximas 2 horas`,
        updated: 0,
        apiCallsUsed: 0,
        status: 200,
      };
    }
  }

  let apiFixtures: Record<string, unknown>[] = [];
  try {
    const data = (await fetchFromApiSport(
      `/fixtures?league=${WORLD_CUP_ID}&season=2026`
    )) as { response?: Record<string, unknown>[] };
    apiFixtures = data.response ?? [];
  } catch {
    apiFixtures = [];
  }

  let updatedCount = 0;

  for (const match of relevantMatches) {
    const apiMatch = apiFixtures.find(
      (f) => (f as { fixture?: { id?: number } })?.fixture?.id === match.id
    );

    if (!apiMatch) continue;

    const fixture = apiMatch as {
      fixture?: { status?: { short?: string } };
      goals?: { home?: number | null; away?: number | null };
    };

    const status = fixture.fixture?.status?.short;
    if (!status) continue;

    const isFinished = status === "FT";
    const isLive = ["1H", "2H", "HT", "ET", "P", "LIVE"].includes(status);

    if (!isFinished && !isLive) continue;

    const goalsHome = fixture.goals?.home ?? null;
    const goalsAway = fixture.goals?.away ?? null;

    if (goalsHome === null || goalsAway === null) continue;

    const newStatus = isFinished ? "FT" : "LIVE";

    const { error: updateError } = await supabase
      .from("matches")
      .update({
        goles_local: goalsHome,
        goles_visitante: goalsAway,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    if (updateError) continue;

    if (isFinished) {
      await supabase.rpc("process_match_results", {
        p_match_id: match.id,
      });
    }

    updatedCount++;
  }

  return {
    message: `${updatedCount} partidos actualizados de ${relevantMatches.length} consultados`,
    updated: updatedCount,
    totalChecked: relevantMatches.length,
    apiCallsUsed: 1,
    status: 200,
  };
}

export async function GET() {
  try {
    const result = await syncResults();
    return NextResponse.json(result, { status: result.status ?? 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return NextResponse.json(
        { error: "Limite de peticiones alcanzado." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await syncResults();
    return NextResponse.json(result, { status: result.status ?? 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return NextResponse.json(
        { error: "Limite de peticiones alcanzado." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
