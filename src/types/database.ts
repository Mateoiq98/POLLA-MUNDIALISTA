export interface User {
  id: string;
  nombre: string;
  avatar_url: string | null;
  puntos_totales: number;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  password_hash: string;
  max_participants: number;
  created_by: string | null;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
}

export interface GroupWithCount extends Group {
  member_count?: number;
  is_member?: boolean;
}

export interface Match {
  id: number;
  equipo_local: string;
  equipo_visitante: string;
  logo_local: string | null;
  logo_visitante: string | null;
  goles_local: number | null;
  goles_visitante: number | null;
  fase: string;
  fecha_partido: string;
  status: string;
  created_at: string;
  updated_at: string | null;
}

export interface Prediction {
  id: string;
  user_id: string;
  match_id: number;
  pred_goles_local: number;
  pred_goles_visitante: number;
  puntos_ganados: number;
  procesado: boolean;
  created_at: string;
}

export interface PredictionWithMatch extends Prediction {
  matches: Match;
}

export interface LeaderboardEntry {
  id: string;
  nombre: string;
  avatar_url: string | null;
  puntos_totales: number;
}

export type Phase =
  | "16avos de final"
  | "Octavos de final"
  | "Cuartos de final"
  | "Semifinal"
  | "Final";

export const PHASES: Phase[] = [
  "16avos de final",
  "Octavos de final",
  "Cuartos de final",
  "Semifinal",
  "Final",
];

export const PHASE_ORDER: Record<Phase, number> = {
  "16avos de final": 1,
  "Octavos de final": 2,
  "Cuartos de final": 3,
  Semifinal: 4,
  Final: 5,
};
