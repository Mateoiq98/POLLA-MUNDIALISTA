"use client";

import { useState, useEffect, useCallback, useSyncExternalStore, useMemo } from "react";
import { motion } from "framer-motion";
import { createBrowserClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Trophy, Medal, Crown, Star, RefreshCw, Users, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Navbar from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

const REFRESH_INTERVAL = 30000;
const LEADERBOARD_CACHE_PREFIX = "polla_leaderboard:";

function getGroupId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("polla_group");
}

function getGroupIdSnapshot() {
  return getGroupId();
}

function getGroupIdServerSnapshot() {
  return null;
}

function subscribeGroupId() {
  return () => {};
}

interface Entry {
  id: string;
  nombre: string;
  avatar_url: string | null;
  puntos_totales: number;
}

interface LeaderboardData {
  entries: Entry[];
  groupName: string;
  updatedAt: number;
}

type JoinedValue<T> = T | T[] | null;

interface MemberLeaderboardRow {
  users: JoinedValue<Entry>;
  groups: JoinedValue<{ name: string }>;
}

const inFlightLeaderboardRequests = new Map<string, Promise<LeaderboardData>>();

function cacheKey(groupId: string | null) {
  return `${LEADERBOARD_CACHE_PREFIX}${groupId ?? "global"}`;
}

function getSingle<T>(value: JoinedValue<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function sortEntries(entries: Entry[]) {
  return [...entries].sort((a, b) => b.puntos_totales - a.puntos_totales);
}

function readCachedLeaderboard(groupId: string | null): LeaderboardData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(cacheKey(groupId));
    return raw ? (JSON.parse(raw) as LeaderboardData) : null;
  } catch {
    return null;
  }
}

function writeCachedLeaderboard(groupId: string | null, data: LeaderboardData) {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(cacheKey(groupId), JSON.stringify(data));
  } catch {
    // Cache is only a speed boost; ignore storage failures.
  }
}

async function fetchGlobalLeaderboard(
  supabase: SupabaseClient
): Promise<LeaderboardData> {
  const { data } = await supabase
    .from("users")
    .select("id, nombre, avatar_url, puntos_totales")
    .order("puntos_totales", { ascending: false });

  return {
    entries: data ?? [],
    groupName: "",
    updatedAt: Date.now(),
  };
}

async function fetchGroupLeaderboard(
  supabase: SupabaseClient,
  groupId: string
): Promise<LeaderboardData> {
  const { data, error } = await supabase
    .from("group_members")
    .select("users(id, nombre, avatar_url, puntos_totales), groups(name)")
    .eq("group_id", groupId);

  if (!error && data) {
    const rows = data as unknown as MemberLeaderboardRow[];
    const entries = rows
      .map((row) => getSingle(row.users))
      .filter((entry): entry is Entry => Boolean(entry));
    const groupName =
      rows.map((row) => getSingle(row.groups)?.name).find(Boolean) ?? "";

    return {
      entries: sortEntries(entries),
      groupName,
      updatedAt: Date.now(),
    };
  }

  const [groupRes, membersRes] = await Promise.all([
    supabase.from("groups").select("name").eq("id", groupId).single(),
    supabase.from("group_members").select("user_id").eq("group_id", groupId),
  ]);

  const memberIds = (membersRes.data || []).map((m) => m.user_id);

  if (memberIds.length === 0) {
    return {
      entries: [],
      groupName: groupRes.data?.name ?? "",
      updatedAt: Date.now(),
    };
  }

  const { data: users } = await supabase
    .from("users")
    .select("id, nombre, avatar_url, puntos_totales")
    .in("id", memberIds)
    .order("puntos_totales", { ascending: false });

  return {
    entries: users ?? [],
    groupName: groupRes.data?.name ?? "",
    updatedAt: Date.now(),
  };
}

function fetchLeaderboard(
  supabase: SupabaseClient,
  groupId: string | null
): Promise<LeaderboardData> {
  const key = groupId ?? "global";
  const existing = inFlightLeaderboardRequests.get(key);
  if (existing) return existing;

  const request = (groupId
    ? fetchGroupLeaderboard(supabase, groupId)
    : fetchGlobalLeaderboard(supabase)
  ).finally(() => {
    inFlightLeaderboardRequests.delete(key);
  });

  inFlightLeaderboardRequests.set(key, request);
  return request;
}

const RankIcon = ({ rank }: { rank: number }) => {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 text-yellow-400" />;
    case 2:
      return <Medal className="w-5 h-5 text-gray-300" />;
    case 3:
      return <Medal className="w-5 h-5 text-amber-600" />;
    default:
      return <Star className="w-4 h-4 text-muted-foreground" />;
  }
};

const rankStyles = [
  "",
  "border-yellow-500/30 bg-yellow-500/5",
  "border-gray-400/20 bg-gray-400/5",
  "border-amber-600/20 bg-amber-600/5",
];

export default function LeaderboardPage() {
  const groupId = useSyncExternalStore(subscribeGroupId, getGroupIdSnapshot, getGroupIdServerSnapshot);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const supabase = createBrowserClient();

  const applyLeaderboard = useCallback((data: LeaderboardData) => {
    setEntries(data.entries);
    setGroupName(data.groupName);
    setLastUpdate(new Date(data.updatedAt));
  }, []);

  const loadEntries = useCallback(async (useCache = false) => {
    try {
      const cached = useCache ? readCachedLeaderboard(groupId) : null;
      if (cached) {
        applyLeaderboard(cached);
        setLoading(false);
      }

      const fresh = await fetchLeaderboard(supabase, groupId);
      writeCachedLeaderboard(groupId, fresh);
      applyLeaderboard(fresh);
    } catch {
      // Handle silently
    } finally {
      setLoading(false);
    }
  }, [supabase, groupId, applyLeaderboard]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadEntries(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadEntries]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshing(true);
      loadEntries().finally(() => setRefreshing(false));
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadEntries]);

  const getRankStyle = (rank: number) => rankStyles[rank] || rankStyles[0];

  const leaderboardStats = useMemo(() => {
    const leader = entries[0] ?? null;
    const totalPoints = entries.reduce(
      (sum, entry) => sum + entry.puntos_totales,
      0
    );
    const average =
      entries.length > 0 ? Math.round(totalPoints / entries.length) : 0;

    return {
      leader,
      average,
      participants: entries.length,
    };
  }, [entries]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-green-500/20 border border-yellow-500/30 mb-4">
            <Trophy className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Tabla de Posiciones</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {groupName ? `${groupName} · ` : ""}Ranking en tiempo real
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <RefreshCw
              className={`w-3.5 h-3.5 text-muted-foreground ${
                refreshing ? "animate-spin" : ""
              }`}
            />
            <span className="text-[11px] text-muted-foreground">
              Actualiza cada 30s · {lastUpdate.toLocaleTimeString("es-ES")}
            </span>
          </div>
        </motion.div>

        {!loading && entries.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
            <div className="glass rounded-2xl p-3 text-center">
              <Crown className="w-4 h-4 mx-auto text-amber-700" />
              <p className="mt-1 text-xs text-muted-foreground">Lider</p>
              <p className="text-sm font-bold text-foreground truncate">
                {leaderboardStats.leader?.nombre}
              </p>
            </div>
            <div className="glass rounded-2xl p-3 text-center">
              <Users className="w-4 h-4 mx-auto text-emerald-700" />
              <p className="mt-1 text-xs text-muted-foreground">Jugadores</p>
              <p className="text-sm font-bold text-foreground">
                {leaderboardStats.participants}
              </p>
            </div>
            <div className="glass rounded-2xl p-3 text-center">
              <TrendingUp className="w-4 h-4 mx-auto text-sky-700" />
              <p className="mt-1 text-xs text-muted-foreground">Promedio</p>
              <p className="text-sm font-bold text-foreground">
                {leaderboardStats.average} pts
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl p-4 flex items-center gap-4">
                <Skeleton className="w-8 h-8 rounded-full bg-white/5" />
                <Skeleton className="w-12 h-12 rounded-full bg-white/5" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24 bg-white/5" />
                  <Skeleton className="h-3 w-16 bg-white/5" />
                </div>
                <Skeleton className="h-6 w-12 bg-white/5" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">
              {groupId ? "No hay miembros en este grupo aun." : "Aun no hay jugadores registrados."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className={`glass rounded-2xl p-4 flex items-center gap-4 border transition-all duration-200 hover:bg-white/[0.03] ${getRankStyle(
                  index + 1
                )}`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="w-8 flex items-center justify-center">
                  <RankIcon rank={index + 1} />
                </div>

                <div className="text-lg font-bold text-muted-foreground w-8 text-center">
                  {index + 1}
                </div>

                <Avatar className="w-12 h-12 border-2 border-white/10">
                  <AvatarImage src={entry.avatar_url || undefined} loading="lazy" />
                  <AvatarFallback className="bg-gradient-to-br from-yellow-500/20 to-green-500/20 text-yellow-400 font-bold">
                    {entry.nombre.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {entry.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.puntos_totales === 1 ? "punto" : "puntos"}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-bold text-gradient">
                    {entry.puntos_totales}
                  </span>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    pts
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
