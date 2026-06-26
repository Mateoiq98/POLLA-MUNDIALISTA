"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import LoginScreen from "@/components/LoginScreen";
import GroupSelector from "@/components/GroupSelector";

function getSnapshot() {
  return localStorage.getItem("polla_user");
}

function getServerSnapshot() {
  return null;
}

function subscribe() {
  return () => {};
}

export default function HomePage() {
  const router = useRouter();
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(
    typeof window !== "undefined"
      ? localStorage.getItem("polla_group")
      : null
  );

  if (!stored) {
    return <LoginScreen onLogin={() => router.refresh()} />;
  }

  const user = JSON.parse(stored);

  if (!selectedGroup) {
    return (
      <GroupSelector
        userId={user.id}
        userName={user.nombre}
        isAdmin={user.nombre?.toLowerCase() === "mateo"}
        onGroupSelected={(groupId) => {
          localStorage.setItem("polla_group", groupId);
          setSelectedGroup(groupId);
        }}
      />
    );
  }

  router.push("/dashboard");
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
