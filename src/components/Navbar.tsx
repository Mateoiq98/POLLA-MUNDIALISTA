"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Trophy,
  Target,
  BarChart3,
  Settings,
  LogOut,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createBrowserClient } from "@/lib/supabase/client";

interface UserData {
  id: string;
  nombre: string;
  avatar_url: string | null;
}

interface UserGroup {
  id: string;
  name: string;
}

type JoinedValue<T> = T | T[] | null;

interface UserGroupRow {
  groups: JoinedValue<UserGroup>;
}

const PUBLIC_NAV = [
  { href: "/leaderboard", label: "Posiciones", icon: BarChart3 },
];

const AUTHED_NAV = [
  { href: "/dashboard", label: "Pronosticos", icon: Target },
  { href: "/leaderboard", label: "Posiciones", icon: BarChart3 },
];

const ADMIN_NAV = [
  { href: "/dashboard", label: "Pronosticos", icon: Target },
  { href: "/leaderboard", label: "Posiciones", icon: BarChart3 },
  { href: "/admin", label: "Admin", icon: Settings },
];

function getUserSnapshot() {
  return localStorage.getItem("polla_user");
}

function getUserServerSnapshot() {
  return null;
}

function subscribeUser() {
  return () => {};
}

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

function getSingle<T>(value: JoinedValue<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const stored = useSyncExternalStore(
    subscribeUser,
    getUserSnapshot,
    getUserServerSnapshot
  );
  const user: UserData | null = stored ? JSON.parse(stored) : null;
  const groupId = useSyncExternalStore(
    subscribeGroupId,
    getGroupIdSnapshot,
    getGroupIdServerSnapshot
  );
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const supabase = createBrowserClient();

  useEffect(() => {
    if (!user) return;
    const loadGroups = async () => {
      const { data: joinedRows, error } = await supabase
        .from("group_members")
        .select("groups(id, name)")
        .eq("user_id", user.id);

      if (!error && joinedRows) {
        const groups = (joinedRows as unknown as UserGroupRow[])
          .map((row) => getSingle(row.groups))
          .filter((group): group is UserGroup => Boolean(group));
        setUserGroups(groups);
        return;
      }

      const { data: memberRows } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);

      if (!memberRows || memberRows.length === 0) {
        setUserGroups([]);
        return;
      }

      const groupIds = memberRows.map((m) => m.group_id);
      const { data: groupsData } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", groupIds);

      if (groupsData) setUserGroups(groupsData);
    };
    loadGroups();
  }, [user, supabase]);

  const isAdmin = user?.nombre?.toLowerCase() === "mateo";
  const navItems = user ? (isAdmin ? ADMIN_NAV : AUTHED_NAV) : PUBLIC_NAV;

  const handleLogout = () => {
    localStorage.removeItem("polla_user");
    localStorage.removeItem("polla_group");
    router.push("/");
  };

  const switchGroup = (newGroupId: string) => {
    localStorage.setItem("polla_group", newGroupId);
    router.refresh();
  };

  return (
    <>
      <nav className="sticky top-0 z-50 glass-strong border-b border-white/10 w-full">
      <div className="w-full max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => (user ? router.push("/dashboard") : router.push("/"))}
          className="flex items-center gap-2 shrink-0"
        >
          <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
          <span className="text-base sm:text-lg font-bold text-gradient hidden sm:block">
            Polla Mundial ⚽
          </span>
        </button>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  isActive
                  ? "text-yellow-400"
                  : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-yellow-500/10 border border-yellow-500/20 rounded-xl"
                    transition={{
                      type: "spring",
                      bounce: 0.2,
                      duration: 0.6,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <>
              <div className="flex items-center gap-2">
                <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border border-yellow-500/30">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="bg-yellow-500/20 text-yellow-400 text-[10px] sm:text-xs font-bold">
                    {user.nombre.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:block">
                  {user.nombre}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="p-1.5 sm:p-2 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Cerrar sesion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {user && userGroups.length > 1 && (
        <div className="w-full max-w-5xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {userGroups.map((g) => (
            <button
              key={g.id}
              onClick={() => switchGroup(g.id)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                g.id === groupId
                  ? "text-cyan-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {g.id === groupId && (
                <motion.div
                  layoutId="group-tab"
                    className="absolute inset-0 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
                  transition={{
                    type: "spring",
                    bounce: 0.2,
                    duration: 0.6,
                  }}
                />
              )}
              <Users className="w-3 h-3 relative z-10" />
              <span className="relative z-10">{g.name}</span>
            </button>
          ))}
        </div>
      )}
      </nav>
      <div className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-slate-900/10 bg-white/88 backdrop-blur-2xl shadow-[0_-12px_35px_rgba(15,23,42,0.12)]">
        <div
          className="mx-auto grid max-w-5xl px-2 pt-2 pb-[calc(0.55rem+env(safe-area-inset-bottom))]"
          style={{
            gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`relative flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition-all ${
                  isActive
                    ? "text-emerald-700"
                    : "text-muted-foreground hover:bg-slate-900/[0.04] hover:text-foreground"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute inset-1 rounded-2xl bg-emerald-600/10 ring-1 ring-emerald-700/15"
                    transition={{
                      type: "spring",
                      bounce: 0.22,
                      duration: 0.5,
                    }}
                  />
                )}
                <Icon className="relative z-10 w-5 h-5" />
                <span className="relative z-10 leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
