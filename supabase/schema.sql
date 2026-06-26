CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  puntos_totales INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. GROUPS TABLE
-- ============================================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  max_participants INTEGER NOT NULL DEFAULT 8,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. GROUP MEMBERS (junction table)
-- ============================================================
CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- ============================================================
-- 4. MATCHES TABLE
-- ============================================================
CREATE TABLE matches (
  id INTEGER PRIMARY KEY,
  equipo_local TEXT NOT NULL DEFAULT 'Por definir',
  equipo_visitante TEXT NOT NULL DEFAULT 'Por definir',
  logo_local TEXT,
  logo_visitante TEXT,
  goles_local INTEGER,
  goles_visitante INTEGER,
  fase TEXT NOT NULL,
  fecha_partido TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'NS',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. PREDICTIONS TABLE
-- ============================================================
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  pred_goles_local INTEGER NOT NULL DEFAULT 0,
  pred_goles_visitante INTEGER NOT NULL DEFAULT 0,
  puntos_ganados INTEGER DEFAULT 0,
  procesado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- ============================================================
-- 6. INDEXES
-- ============================================================
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_fase ON matches(fase);
CREATE INDEX idx_matches_updated_at ON matches(updated_at);
CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_match_id ON predictions(match_id);
CREATE INDEX idx_users_nombre ON users(nombre);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);

-- ============================================================
-- 7. RLS (Row Level Security)
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (true);

CREATE POLICY "Anyone can view groups" ON groups FOR SELECT USING (true);
CREATE POLICY "Authenticated can create groups" ON groups FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view group members" ON group_members FOR SELECT USING (true);
CREATE POLICY "Authenticated can join groups" ON group_members FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view matches" ON matches FOR SELECT USING (true);

CREATE POLICY "Anyone can view predictions" ON predictions FOR SELECT USING (true);
CREATE POLICY "Users can insert own predictions" ON predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own predictions" ON predictions FOR UPDATE USING (true);

-- ============================================================
-- 8. STORAGE BUCKET for avatars
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars');

-- ============================================================
-- 9. SCORING FUNCTION (RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_prediction_points(
  p_pred_local INTEGER,
  p_pred_visit INTEGER,
  p_real_local INTEGER,
  p_real_visit INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pred_diff INTEGER;
  v_real_diff INTEGER;
  v_diff_diff INTEGER;
  v_pred_sign INTEGER;
  v_real_sign INTEGER;
BEGIN
  v_pred_diff := p_pred_local - p_pred_visit;
  v_real_diff := p_real_local - p_real_visit;
  v_diff_diff := ABS(v_pred_diff - v_real_diff);

  IF v_pred_diff > 0 THEN v_pred_sign := 1;
  ELSIF v_pred_diff < 0 THEN v_pred_sign := -1;
  ELSE v_pred_sign := 0;
  END IF;

  IF v_real_diff > 0 THEN v_real_sign := 1;
  ELSIF v_real_diff < 0 THEN v_real_sign := -1;
  ELSE v_real_sign := 0;
  END IF;

  IF p_pred_local = p_real_local AND p_pred_visit = p_real_visit THEN
    RETURN 5;
  END IF;

  IF v_pred_sign = v_real_sign AND v_diff_diff = 1 THEN
    RETURN 3;
  END IF;

  IF v_pred_sign = v_real_sign THEN
    RETURN 2;
  END IF;

  RETURN 0;
END;
$$;

-- ============================================================
-- 10. FUNCTION TO PROCESS MATCH RESULTS AND UPDATE POINTS
-- ============================================================
CREATE OR REPLACE FUNCTION process_match_results(p_match_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_match RECORD;
  v_pred RECORD;
  v_points INTEGER;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id AND status = 'FT';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR v_pred IN
    SELECT * FROM predictions WHERE match_id = p_match_id AND procesado = FALSE
  LOOP
    v_points := calculate_prediction_points(
      v_pred.pred_goles_local,
      v_pred.pred_goles_visitante,
      v_match.goles_local,
      v_match.goles_visitante
    );

    UPDATE predictions
    SET puntos_ganados = v_points, procesado = TRUE
    WHERE id = v_pred.id;

    UPDATE users
    SET puntos_totales = puntos_totales + v_points
    WHERE id = v_pred.user_id;
  END LOOP;
END;
$$;
