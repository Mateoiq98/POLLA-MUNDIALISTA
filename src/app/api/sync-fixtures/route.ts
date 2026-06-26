import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const API_FOOTBALL_URL = "https://v3.football.api-sports.io";
const WORLD_CUP_ID = 1;

const WORLD_CUP_FIXTURES = [
  { id: 4001, phase: "16avos de final", date: "2026-06-27T16:00:00Z" },
  { id: 4002, phase: "16avos de final", date: "2026-06-27T20:00:00Z" },
  { id: 4003, phase: "16avos de final", date: "2026-06-28T16:00:00Z" },
  { id: 4004, phase: "16avos de final", date: "2026-06-28T20:00:00Z" },
  { id: 4005, phase: "16avos de final", date: "2026-06-29T16:00:00Z" },
  { id: 4006, phase: "16avos de final", date: "2026-06-29T20:00:00Z" },
  { id: 4007, phase: "16avos de final", date: "2026-06-30T16:00:00Z" },
  { id: 4008, phase: "16avos de final", date: "2026-06-30T20:00:00Z" },
  { id: 4009, phase: "16avos de final", date: "2026-07-01T16:00:00Z" },
  { id: 4010, phase: "16avos de final", date: "2026-07-01T20:00:00Z" },
  { id: 4011, phase: "16avos de final", date: "2026-07-02T16:00:00Z" },
  { id: 4012, phase: "16avos de final", date: "2026-07-02T20:00:00Z" },
  { id: 4013, phase: "16avos de final", date: "2026-07-03T16:00:00Z" },
  { id: 4014, phase: "16avos de final", date: "2026-07-03T20:00:00Z" },
  { id: 4015, phase: "16avos de final", date: "2026-07-04T16:00:00Z" },
  { id: 4016, phase: "16avos de final", date: "2026-07-04T20:00:00Z" },
  { id: 4017, phase: "Octavos de final", date: "2026-07-06T16:00:00Z" },
  { id: 4018, phase: "Octavos de final", date: "2026-07-06T20:00:00Z" },
  { id: 4019, phase: "Octavos de final", date: "2026-07-07T16:00:00Z" },
  { id: 4020, phase: "Octavos de final", date: "2026-07-07T20:00:00Z" },
  { id: 4021, phase: "Octavos de final", date: "2026-07-08T16:00:00Z" },
  { id: 4022, phase: "Octavos de final", date: "2026-07-08T20:00:00Z" },
  { id: 4023, phase: "Octavos de final", date: "2026-07-09T16:00:00Z" },
  { id: 4024, phase: "Octavos de final", date: "2026-07-09T20:00:00Z" },
  { id: 4025, phase: "Cuartos de final", date: "2026-07-11T18:00:00Z" },
  { id: 4026, phase: "Cuartos de final", date: "2026-07-11T22:00:00Z" },
  { id: 4027, phase: "Cuartos de final", date: "2026-07-12T18:00:00Z" },
  { id: 4028, phase: "Cuartos de final", date: "2026-07-12T22:00:00Z" },
  { id: 4029, phase: "Semifinal", date: "2026-07-15T20:00:00Z" },
  { id: 4030, phase: "Semifinal", date: "2026-07-16T20:00:00Z" },
  { id: 4031, phase: "Final", date: "2026-07-19T20:00:00Z" },
];

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

async function syncFixtures() {
  const supabase = createServerClient();

  const { count } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true });

  if (count && count >= WORLD_CUP_FIXTURES.length) {
    const { data: needUpdate } = await supabase
      .from("matches")
      .select("id")
      .eq("equipo_local", "Por definir")
      .limit(1);

    if (!needUpdate || needUpdate.length === 0) {
      return {
        message: "Los partidos ya estan sincronizados con equipos reales",
        count,
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

  const fixturesToUpsert = WORLD_CUP_FIXTURES.map((fixture) => {
    const apiMatch = apiFixtures.find(
      (f) => (f as { fixture?: { id?: number } })?.fixture?.id === fixture.id
    );

    const teams = (apiMatch as {
      teams?: {
        home?: { name?: string; logo?: string };
        away?: { name?: string; logo?: string };
      };
    })?.teams;

    return {
      id: fixture.id,
      equipo_local: teams?.home?.name ?? "Por definir",
      equipo_visitante: teams?.away?.name ?? "Por definir",
      logo_local: teams?.home?.logo ?? null,
      logo_visitante: teams?.away?.logo ?? null,
      goles_local: null,
      goles_visitante: null,
      fase: fixture.phase,
      fecha_partido: fixture.date,
      status: "NS",
    };
  });

  const { error } = await supabase
    .from("matches")
    .upsert(fixturesToUpsert, { onConflict: "id" });

  if (error) {
    return { error: error.message, status: 500 };
  }

  return {
    message: `${fixturesToUpsert.length} partidos sincronizados`,
    count: fixturesToUpsert.length,
    apiCallsUsed: 1,
    status: 200,
  };
}

export async function GET() {
  try {
    const result = await syncFixtures();
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
    const result = await syncFixtures();
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
