"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  LogIn,
  Lock,
  Loader2,
  ArrowLeft,
  UserPlus,
  Crown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createBrowserClient } from "@/lib/supabase/client";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { toast } from "sonner";
import type { GroupWithCount } from "@/types/database";

interface GroupSelectorProps {
  userId: string;
  userName: string;
  isAdmin: boolean;
  onGroupSelected: (groupId: string) => void;
}

export default function GroupSelector({
  userId,
  userName,
  isAdmin,
  onGroupSelected,
}: GroupSelectorProps) {
  const [view, setView] = useState<"list" | "join" | "create">("list");
  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [groupPassword, setGroupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const supabase = createBrowserClient();

  const loadGroups = useCallback(async () => {
    const { data: groupsData } = await supabase
      .from("groups")
      .select("*");

    if (!groupsData) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const { data: membersData } = await supabase
      .from("group_members")
      .select("group_id, user_id");

    const memberCounts: Record<string, number> = {};
    const userGroups: Set<string> = new Set();
    for (const m of membersData || []) {
      memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1;
      if (m.user_id === userId) userGroups.add(m.group_id);
    }

    const enriched = groupsData.map((g) => ({
      ...g,
      member_count: memberCounts[g.id] || 0,
      is_member: userGroups.has(g.id),
    }));

    setGroups(enriched);

    const memberOf = enriched.find((g) => g.is_member);
    if (memberOf) {
      onGroupSelected(memberOf.id);
      return;
    }

    setLoading(false);
  }, [supabase, userId, onGroupSelected]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const group = groups.find((g) => g.id === selectedGroupId);
      if (!group) {
        setError("Grupo no encontrado");
        setSubmitting(false);
        return;
      }

      if ((group.member_count ?? 0) >= group.max_participants) {
        setError("Este grupo esta lleno");
        setSubmitting(false);
        return;
      }

      const valid = await verifyPassword(groupPassword, group.password_hash);
      if (!valid) {
        setError("Contraseña incorrecta");
        setSubmitting(false);
        return;
      }

      const { error: joinError } = await supabase
        .from("group_members")
        .insert({ group_id: group.id, user_id: userId });

      if (joinError) {
        if (joinError.message.includes("duplicate")) {
          setError("Ya eres miembro de este grupo");
        } else {
          setError("Error al unirse al grupo");
        }
        setSubmitting(false);
        return;
      }

      toast.success(`Te uniste a ${group.name}`);
      onGroupSelected(group.id);
    } catch {
      setError("Error inesperado");
      setSubmitting(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (!groupName.trim()) {
        setError("Nombre del grupo requerido");
        setSubmitting(false);
        return;
      }
      if (groupPassword.length < 4) {
        setError("La contraseña debe tener al menos 4 caracteres");
        setSubmitting(false);
        return;
      }
      if (groupPassword !== confirmPassword) {
        setError("Las contraseñas no coinciden");
        setSubmitting(false);
        return;
      }

      const passwordHash = await hashPassword(groupPassword);

      const { data: newGroup, error: createError } = await supabase
        .from("groups")
        .insert({
          name: groupName.trim(),
          password_hash: passwordHash,
          max_participants: maxParticipants,
          created_by: userId,
        })
        .select("id")
        .single();

      if (createError) {
        setError("Error al crear el grupo");
        setSubmitting(false);
        return;
      }

      const { error: joinError } = await supabase
        .from("group_members")
        .insert({ group_id: newGroup.id, user_id: userId });

      if (joinError) {
        setError("Grupo creado pero no se pudo unir");
        setSubmitting(false);
        return;
      }

      toast.success(`Grupo "${groupName.trim()}" creado`);
      onGroupSelected(newGroup.id);
    } catch {
      setError("Error inesperado");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-strong rounded-3xl p-8 neon-glow">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-green-500/20 border border-yellow-500/30 mb-4">
              <Users className="w-8 h-8 text-yellow-400" />
            </div>
            <h1 className="text-2xl font-bold text-gradient">Grupos</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Hola {userName}, elige o crea un grupo
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {view === "list" && (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-3"
              >
                {groups.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center mb-2">
                    Grupos disponibles
                  </p>
                )}

                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      if (group.is_member) {
                        onGroupSelected(group.id);
                      } else {
                        setSelectedGroupId(group.id);
                        setView("join");
                      }
                    }}
                    className="w-full glass rounded-xl p-4 flex items-center gap-4 border border-white/5 hover:border-yellow-500/30 transition-all"
                  >
                        <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                      <Users className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-foreground">
                        {group.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {group.member_count}/{group.max_participants} miembros
                        {group.is_member && (
                          <span className="text-yellow-400 ml-2">● Unido</span>
                        )}
                      </p>
                    </div>
                    {group.is_member ? (
                      <Crown className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <LogIn className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                ))}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setView("join")}
                    className={`${isAdmin ? "flex-1" : "w-full"} py-3 rounded-xl text-sm font-medium glass border border-white/10 text-muted-foreground hover:text-foreground hover:border-yellow-500/30 transition-all flex items-center justify-center gap-2`}
                  >
                    <LogIn className="w-4 h-4" />
                    Unirse
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setView("create")}
                      className="flex-1 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-yellow-500 to-emerald-500 text-white hover:from-yellow-400 hover:to-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20"
                    >
                      <Plus className="w-4 h-4" />
                      Crear grupo
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {view === "join" && (
              <motion.form
                key="join"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleJoinGroup}
                className="space-y-4"
              >
                <button
                  type="button"
                  onClick={() => {
                    setView("list");
                    setError("");
                    setGroupPassword("");
                  }}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-yellow-400 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver
                </button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Unirse a{" "}
                      <span className="text-yellow-400 font-medium">
                      {groups.find((g) => g.id === selectedGroupId)?.name}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Contraseña del grupo
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="password"
                      value={groupPassword}
                      onChange={(e) => {
                        setGroupPassword(e.target.value);
                        setError("");
                      }}
                      placeholder="Contraseña del grupo"
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={submitting || !groupPassword}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 bg-gradient-to-r from-yellow-500 to-emerald-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Unirse al grupo
                    </>
                  )}
                </motion.button>
              </motion.form>
            )}

            {view === "create" && (
              <motion.form
                key="create"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleCreateGroup}
                className="space-y-4"
              >
                <button
                  type="button"
                  onClick={() => {
                    setView("list");
                    setError("");
                    setGroupName("");
                    setGroupPassword("");
                    setConfirmPassword("");
                  }}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-yellow-400 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver
                </button>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Nombre del grupo
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => {
                      setGroupName(e.target.value);
                      setError("");
                    }}
                    placeholder="Ej: Familia, Master Gym..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground/50                     focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Maximo de participantes
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={maxParticipants}
                    onChange={(e) =>
                      setMaxParticipants(parseInt(e.target.value) || 8)
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Contraseña del grupo
                  </label>
                  <input
                    type="password"
                    value={groupPassword}
                    onChange={(e) => {
                      setGroupPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Minimo 4 caracteres"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Confirmar contraseña
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Repite la contraseña"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
                  />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={submitting || !groupName || !groupPassword}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 bg-gradient-to-r from-yellow-500 to-emerald-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Crear grupo
                    </>
                  )}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
