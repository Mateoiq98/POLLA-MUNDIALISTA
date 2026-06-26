"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Lock, Check, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Match, Prediction } from "@/types/database";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";

export interface OtherPrediction {
  user_id: string;
  nombre: string;
  avatar_url: string | null;
  pred_goles_local: number;
  pred_goles_visitante: number;
  puntos_ganados: number;
}

interface MatchCardProps {
  match: Match;
  prediction: Prediction | null;
  otherPredictions: OtherPrediction[];
  userId: string;
  index: number;
}

function ScoreControl({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
        className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-foreground hover:bg-white/10 hover:border-cyan-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-8 text-center text-xl font-bold tabular-nums text-foreground">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(12, value + 1))}
        disabled={disabled || value >= 12}
        className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-foreground hover:bg-white/10 hover:border-cyan-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function MatchCard({ match, prediction, otherPredictions, userId, index }: MatchCardProps) {
  const [predLocal, setPredLocal] = useState(prediction?.pred_goles_local ?? 0);
  const [predVisit, setPredVisit] = useState(prediction?.pred_goles_visitante ?? 0);
  const [saving, setSaving] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const supabase = createBrowserClient();

  const isLocked =
    match.status === "FT" ||
    new Date(match.fecha_partido) < new Date();

  const hasChanges = useMemo(() => {
    const origLocal = prediction?.pred_goles_local ?? 0;
    const origVisit = prediction?.pred_goles_visitante ?? 0;
    return predLocal !== origLocal || predVisit !== origVisit;
  }, [predLocal, predVisit, prediction]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (prediction) {
        const { error } = await supabase
          .from("predictions")
          .update({
            pred_goles_local: predLocal,
            pred_goles_visitante: predVisit,
            procesado: false,
            puntos_ganados: 0,
          })
          .eq("id", prediction.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("predictions").insert({
          user_id: userId,
          match_id: match.id,
          pred_goles_local: predLocal,
          pred_goles_visitante: predVisit,
        });

        if (error) throw error;
      }
      toast.success("Pronostico guardado");
    } catch {
      toast.error("Error al guardar el pronostico");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = () => {
    if (match.status === "FT") {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
          Finalizado
        </Badge>
      );
    }
    if (match.status === "LIVE") {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs animate-pulse">
          En vivo
        </Badge>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`glass rounded-2xl p-5 transition-all ${
        isLocked && match.status !== "FT"
          ? "opacity-75"
          : ""
      } ${match.status === "FT" ? "border-green-500/20" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium">
          {match.fase}
        </span>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {isLocked && match.status !== "FT" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-medium">
              <Lock className="w-3 h-3" />
              Cerrado
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
            {match.logo_local ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={match.logo_local}
                alt={match.equipo_local}
                className="w-8 h-8 object-contain"
              />
            ) : (
              <span className="text-lg">🏳️</span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground truncate">
            {match.equipo_local}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1 min-w-[120px]">
          {match.status === "FT" && match.goles_local !== null && match.goles_visitante !== null ? (
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-foreground">
                {match.goles_local}
              </span>
              <span className="text-muted-foreground">-</span>
              <span className="text-3xl font-bold text-foreground">
                {match.goles_visitante}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <ScoreControl
                value={predLocal}
                onChange={setPredLocal}
                disabled={isLocked || saving}
              />
              <span className="text-muted-foreground text-lg">:</span>
              <ScoreControl
                value={predVisit}
                onChange={setPredVisit}
                disabled={isLocked || saving}
              />
            </div>
          )}

          {match.status === "FT" && prediction && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-muted-foreground">Tu pronostico:</span>
              <span className="text-xs font-medium text-cyan-400">
                {prediction.pred_goles_local} - {prediction.pred_goles_visitante}
              </span>
              {prediction.puntos_ganados > 0 && (
                <Badge className="ml-1 bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
                  +{prediction.puntos_ganados}
                </Badge>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground mt-1">
            {new Date(match.fecha_partido).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <div className="flex-1 text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
            {match.logo_visitante ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={match.logo_visitante}
                alt={match.equipo_visitante}
                className="w-8 h-8 object-contain"
              />
            ) : (
              <span className="text-lg">🏳️</span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground truncate">
            {match.equipo_visitante}
          </p>
        </div>
      </div>

      {isLocked && match.status !== "FT" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20"
        >
          <Lock className="w-4 h-4 text-orange-400 shrink-0" />
          <p className="text-xs text-orange-300 font-medium">
            Partido iniciado. No se pueden cambiar los resultados.
          </p>
        </motion.div>
      )}

      {isLocked && otherPredictions.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowOthers(!showOthers)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-cyan-400 transition-colors"
          >
            {showOthers ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showOthers ? "Ocultar" : "Ver"} pronosticos ({otherPredictions.length})
          </button>

          <AnimatePresence>
            {showOthers && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 space-y-2"
              >
                {otherPredictions.map((p) => (
                  <div
                    key={p.user_id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5"
                  >
                    <Avatar className="w-7 h-7 border border-white/10">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="bg-white/5 text-[10px] font-bold">
                        {p.nombre.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground flex-1 truncate">
                      {p.nombre}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {p.pred_goles_local} - {p.pred_goles_visitante}
                    </span>
                    {p.puntos_ganados > 0 && (
                      <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">
                        +{p.puntos_ganados}
                      </Badge>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {!isLocked && (
        <motion.button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          whileHover={{ scale: hasChanges ? 1.02 : 1 }}
          whileTap={{ scale: hasChanges ? 0.98 : 1 }}
          className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          ) : hasChanges ? (
            <>
              <Check className="w-4 h-4" />
              Guardar Pronostico
            </>
          ) : (
            "Sin cambios"
          )}
        </motion.button>
      )}
    </motion.div>
  );
}
