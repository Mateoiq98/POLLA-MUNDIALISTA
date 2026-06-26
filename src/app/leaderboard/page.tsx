"use client";

import { useState, useEffect, useCallback, useSyncExternalStore, useMemo } from "react";
import { motion } from "framer-motion";
import { createBrowserClient } from "@/lib/supabase/client";
import { Trophy, Medal, Crown, Star, RefreshCw, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Navbar from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

const REFRESH_INTERVAL = 30000;

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

  const loadEntries = useCallback(async () => {
    try {
      if (!groupId) {
        const { data } = await supabase
          .from("users")
          .select("id, nombre, avatar_url, puntos_totales")
          .order("puntos_totales", { ascending: false });
        if (data) setEntries(data);
        setGroupName("");
        setLastUpdate(new Date());
        setLoading(false);
        return;
      }

      const [groupRes, membersRes] = await Promise.all([
        supabase.from("groups").select("name").eq("id", groupId).single(),
        supabase.from("group_members").select("user_id").eq("group_id", groupId),
      ]);

      if (groupRes.data) setGroupName(groupRes.data.name);

      const memberIds = (membersRes.data || []).map((m) => m.user_id);

      if (memberIds.length === 0) {
        setEntries([]);
        setLastUpdate(new Date());
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("id, nombre, avatar_url, puntos_totales")
        .in("id", memberIds)
        .order("puntos_totales", { ascending: false });

      if (data) setEntries(data);
      setLastUpdate(new Date());
    } catch {
      // Handle silently
    } finally {
      setLoading(false);
    }
  }, [supabase, groupId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshing(true);
      loadEntries().finally(() => setRefreshing(false));
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadEntries]);

  const getRankStyle = (rank: number) => rankStyles[rank] || rankStyles[0];

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
