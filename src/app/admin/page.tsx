"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  RefreshCw,
  Activity,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Users,
  Target,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

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

export default function AdminPage() {
  const router = useRouter();
  const stored = useSyncExternalStore(subscribeUser, getUserSnapshot, getUserServerSnapshot);
  const user: UserData | null = stored ? JSON.parse(stored) : null;
  const [syncingFixtures, setSyncingFixtures] = useState(false);
  const [syncingResults, setSyncingResults] = useState(false);
  const [stats, setStats] = useState({
    users: 0,
    matches: 0,
    predictions: 0,
  });
  const supabase = createBrowserClient();

  useEffect(() => {
    if (!user || user.nombre.toLowerCase() !== "mateo") {
      router.push("/dashboard");
      return;
    }

    const loadStats = async () => {
      const [usersRes, matchesRes, predictionsRes] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }),
        supabase.from("matches").select("*", { count: "exact", head: true }),
        supabase.from("predictions").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        users: usersRes.count ?? 0,
        matches: matchesRes.count ?? 0,
        predictions: predictionsRes.count ?? 0,
      });
    };
    loadStats();
  }, [user, router, supabase]);

  const handleSyncFixtures = async () => {
    setSyncingFixtures(true);
    try {
      const res = await fetch("/api/sync-fixtures", { method: "POST" });
      if (res.status === 429) {
        toast.error(
          "Limite de peticiones alcanzado. Por favor, intenta de nuevo en 60 segundos."
        );
        return;
      }
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Partidos sincronizados correctamente");
      } else {
        toast.error(data.error || "Error al sincronizar partidos");
      }
    } catch {
      toast.error("Error de conexion. Intenta de nuevo.");
    } finally {
      setSyncingFixtures(false);
    }
  };

  const handleSyncResults = async () => {
    setSyncingResults(true);
    try {
      const res = await fetch("/api/sync-results", { method: "POST" });
      if (res.status === 429) {
        toast.error(
          "Limite de peticiones alcanzado. Por favor, intenta de nuevo en 60 segundos."
        );
        return;
      }
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Resultados actualizados correctamente");
      } else {
        toast.error(data.error || "Error al actualizar resultados");
      }
    } catch {
      toast.error("Error de conexion. Intenta de nuevo.");
    } finally {
      setSyncingResults(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-foreground">
            Panel de <span className="text-gradient">Administrador</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Controla la sincronizacion de datos del torneo
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-8"
        >
          <div className="glass rounded-2xl p-4 text-center">
            <Users className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.users}</p>
            <p className="text-xs text-muted-foreground">Jugadores</p>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <Target className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.matches}</p>
            <p className="text-xs text-muted-foreground">Partidos</p>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <Trophy className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">
              {stats.predictions}
            </p>
            <p className="text-xs text-muted-foreground">Pronosticos</p>
          </div>
        </motion.div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <RefreshCw className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">
                  Sincronizar Estructura de Partidos
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Descarga los fixtures del torneo desde la API externa y los
                  guarda/actualiza en la base de datos.
                </p>
                <motion.button
                  onClick={handleSyncFixtures}
                  disabled={syncingFixtures}
                  whileHover={{ scale: syncingFixtures ? 1 : 1.02 }}
                  whileTap={{ scale: syncingFixtures ? 1 : 0.98 }}
                  className="mt-4 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm shadow-lg shadow-cyan-500/20"
                >
                  {syncingFixtures ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Sincronizar Ahora
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Activity className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">
                  Actualizar Marcadores en Vivo
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Consulta los partidos en curso o finalizados y actualiza los
                  resultados. El sistema calcula los puntos automaticamente.
                </p>
                <motion.button
                  onClick={handleSyncResults}
                  disabled={syncingResults}
                  whileHover={{ scale: syncingResults ? 1 : 1.02 }}
                  whileTap={{ scale: syncingResults ? 1 : 0.98 }}
                  className="mt-4 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm shadow-lg shadow-emerald-500/20"
                >
                  {syncingResults ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4" />
                      Actualizar Resultados
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-2xl p-6 border border-yellow-500/20"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  Control de Peticiones API
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Plan gratuito: <span className="text-yellow-400 font-medium">100 peticiones/dia</span>. 
                  Cada boton consume 1 peticion. La app esta optimizada para gastar lo minimo.
                </p>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sincronizar partidos: solo 1 vez al inicio del torneo</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Actualizar resultados: solo consulta partidos de HOY o en vivo</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Los usuarios NUNCA llaman a la API externa</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
