"use client";

import {
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserClient } from "@/lib/supabase/client";
import { PHASES, type Match, type Prediction } from "@/types/database";
import MatchCard, { type OtherPrediction } from "@/components/MatchCard";
import Navbar from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

interface UserData {
  id: string;
  nombre: string;
  avatar_url: string | null;
}

function getUserSnapshot() {
  return localStorage.getItem("polla_user");
}

function getUserServerSnapshot() {
  return null;
}

function subscribeUser() {
  return () => {};
}

function MatchSkeleton() {
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20 bg-white/5" />
        <Skeleton className="h-4 w-16 bg-white/5" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex-1 flex flex-col items-center gap-2">
          <Skeleton className="w-12 h-12 rounded-full bg-white/5" />
          <Skeleton className="h-4 w-20 bg-white/5" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-lg bg-white/5" />
          <Skeleton className="w-8 h-8 rounded bg-white/5" />
          <Skeleton className="w-9 h-9 rounded-lg bg-white/5" />
        </div>
        <div className="flex-1 flex flex-col items-center gap-2">
          <Skeleton className="w-12 h-12 rounded-full bg-white/5" />
          <Skeleton className="h-4 w-20 bg-white/5" />
        </div>
      </div>
    </div>
  );
}

const TERMINADOS_TAB = "Terminados";

export default function DashboardPage() {
  const router = useRouter();
  const stored = useSyncExternalStore(
    subscribeUser,
    getUserSnapshot,
    getUserServerSnapshot
  );
  const user: UserData | null = stored ? JSON.parse(stored) : null;
  const groupId =
    typeof window !== "undefined"
      ? localStorage.getItem("polla_group")
      : null;
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [otherPredictionsMap, setOtherPredictionsMap] = useState<
    Record<number, OtherPrediction[]>
  >({});
  const [activePhase, setActivePhase] = useState<string>(PHASES[0]);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const supabase = createBrowserClient();

  const loadData = useCallback(async () => {
    if (!user || !groupId) return;

    try {
      const { data: groupData } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single();
      if (groupData) setGroupName(groupData.name);

      const { data: memberRows } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);
      const memberIds = (memberRows || []).map((m) => m.user_id);

      const [matchesRes, predictionsRes] = await Promise.all([
        supabase
          .from("matches")
          .select("*")
          .order("fecha_partido", { ascending: true }),
        supabase
          .from("predictions")
          .select("*")
          .eq("user_id", user.id),
      ]);

      if (matchesRes.data) setMatches(matchesRes.data);
      if (predictionsRes.data) setPredictions(predictionsRes.data);

      if (
        matchesRes.data &&
        matchesRes.data.length > 0 &&
        memberIds.length > 0
      ) {
        const matchIds = matchesRes.data.map((m) => m.id);
        const { data: allPredictions } = await supabase
          .from("predictions")
          .select(
            "user_id, match_id, pred_goles_local, pred_goles_visitante, puntos_ganados, users(nombre, avatar_url)"
          )
          .in("match_id", matchIds)
          .neq("user_id", user.id)
          .in("user_id", memberIds);

        if (allPredictions) {
          const grouped: Record<number, OtherPrediction[]> = {};
          for (const pred of allPredictions) {
            const users = pred.users as unknown as {
              nombre: string;
              avatar_url: string | null;
            } | null;
            if (!users) continue;
            if (!grouped[pred.match_id]) grouped[pred.match_id] = [];
            grouped[pred.match_id].push({
              user_id: pred.user_id,
              nombre: users.nombre,
              avatar_url: users.avatar_url,
              pred_goles_local: pred.pred_goles_local,
              pred_goles_visitante: pred.pred_goles_visitante,
              puntos_ganados: pred.puntos_ganados,
            });
          }
          setOtherPredictionsMap(grouped);
        }
      }
    } catch {
      // Handle silently
    } finally {
      setLoading(false);
    }
  }, [user, groupId, supabase]);

  useEffect(() => {
    if (!user || !groupId) {
      router.push("/");
      return;
    }
    loadData();
  }, [user, groupId, router, loadData]);

  useEffect(() => {
    const hasLiveOrUpcoming = matches.some(
      (m) => m.status === "LIVE" || m.status === "1H" || m.status === "2H"
    );
    if (!hasLiveOrUpcoming) return;

    const interval = setInterval(() => {
      loadData();
    }, 60000);

    return () => clearInterval(interval);
  }, [matches, loadData]);

  const filteredMatches =
    activePhase === TERMINADOS_TAB
      ? matches.filter((m) => m.status === "FT")
      : matches.filter((m) => m.fase === activePhase && m.status !== "FT");

  const getPrediction = useCallback(
    (matchId: number) =>
      predictions.find((p) => p.match_id === matchId) ?? null,
    [predictions]
  );

  const allTabs = [...PHASES, TERMINADOS_TAB];

  const getTabCount = (phase: string) => {
    if (phase === TERMINADOS_TAB) return matches.filter((m) => m.status === "FT").length;
    return matches.filter((m) => m.fase === phase && m.status !== "FT").length;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            Hola,{" "}
            <span className="text-gradient">{user.nombre}</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {groupName ? `${groupName} · ` : ""}
            Realiza tus pronosticos para cada fase del Mundial
          </p>
        </motion.div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 sm:mb-6 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
          {allTabs.map((phase) => {
            const count = getTabCount(phase);
            const isTerminados = phase === TERMINADOS_TAB;
            return (
              <button
                key={phase}
                onClick={() => setActivePhase(phase)}
                className={`relative px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  activePhase === phase
                    ? isTerminados
                      ? "text-green-400"
                      : "text-yellow-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {activePhase === phase && (
                  <motion.div
                    layoutId="phase-indicator"
                    className={`absolute inset-0 rounded-xl border ${
                      isTerminados
                        ? "bg-yellow-500/10 border-yellow-500/20"
                        : "bg-yellow-500/10 border-yellow-500/20"
                    }`}
                    transition={{
                      type: "spring",
                      bounce: 0.2,
                      duration: 0.6,
                    }}
                  />
                )}
                <span className="relative z-10">
                  {phase} ({count})
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-3 sm:gap-4 sm:grid-cols-2"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <MatchSkeleton key={i} />
              ))}
            </motion.div>
          ) : filteredMatches.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass rounded-2xl p-8 sm:p-12 text-center"
            >
              <p className="text-muted-foreground text-sm">
                {activePhase === TERMINADOS_TAB
                  ? "No hay partidos finalizados aun."
                  : "No hay partidos programados para esta fase aun."}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={activePhase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-3 sm:gap-4 sm:grid-cols-2"
            >
              {filteredMatches.map((match, index) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  prediction={getPrediction(match.id)}
                  otherPredictions={otherPredictionsMap[match.id] ?? []}
                  userId={user.id}
                  index={index}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
