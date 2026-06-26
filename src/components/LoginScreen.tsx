"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Upload, Loader2, Trophy, X, Lock, Eye, EyeOff } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { toast } from "sonner";

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [step, setStep] = useState<"user" | "password">("user");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("La imagen no debe superar 2MB");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = nombre.trim();
    if (!trimmed) {
      setError("Ingresa tu nombre");
      return;
    }

    if (trimmed.length < 2) {
      setError("El nombre debe tener al menos 2 caracteres");
      return;
    }

    setLoading(true);

    try {
      const { data: existing } = await supabase
        .from("users")
        .select("id, nombre")
        .ilike("nombre", trimmed)
        .single();

      if (existing) {
        setIsNewUser(false);
        setNombre(existing.nombre);
      } else {
        setIsNewUser(true);
      }

      setStep("password");
    } catch {
      setIsNewUser(true);
      setStep("password");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || password.length < 4) {
      setError("La contraseña debe tener al menos 4 caracteres");
      return;
    }

    setLoading(true);

    try {
      if (isNewUser) {
        if (password !== confirmPassword) {
          setError("Las contraseñas no coinciden");
          setLoading(false);
          return;
        }

        const passwordHash = await hashPassword(password);

        let avatarUrl: string | null = null;
        if (avatarFile) {
          try {
            const fileName = `${nombre.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("avatars")
              .upload(fileName, avatarFile);

            if (!uploadError && uploadData) {
              const { data: urlData } = supabase.storage
                .from("avatars")
                .getPublicUrl(fileName);
              avatarUrl = urlData.publicUrl;
            }
          } catch {
            // Avatar upload failed, continue without it
          }
        }

        const userId = crypto.randomUUID();
        const { error: insertError } = await supabase.from("users").insert({
          id: userId,
          nombre: nombre.trim(),
          password_hash: passwordHash,
          avatar_url: avatarUrl,
          puntos_totales: 0,
        });

        if (insertError) {
          console.error("Supabase insert error:", insertError);
          if (insertError.message.includes("unique")) {
            setError("Este nombre ya esta registrado. Intenta otro.");
          } else if (insertError.message.includes("password_hash")) {
            setError("Falta la columna password_hash en la BD. Ejecuta el SQL del schema.");
          } else {
            setError(`Error: ${insertError.message}`);
          }
          setLoading(false);
          return;
        }

        localStorage.setItem(
          "polla_user",
          JSON.stringify({
            id: userId,
            nombre: nombre.trim(),
            avatar_url: avatarUrl,
          })
        );

        toast.success(`Bienvenido, ${nombre.trim()}!`);
        onLogin();
      } else {
        const { data: user, error: fetchError } = await supabase
          .from("users")
          .select("id, nombre, password_hash, avatar_url")
          .ilike("nombre", nombre.trim())
          .single();

        if (fetchError || !user) {
          setError("Usuario no encontrado");
          setLoading(false);
          return;
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
          setError("Contraseña incorrecta");
          setLoading(false);
          return;
        }

        localStorage.setItem(
          "polla_user",
          JSON.stringify({
            id: user.id,
            nombre: user.nombre,
            avatar_url: user.avatar_url,
          })
        );

        toast.success(`Bienvenido de nuevo, ${user.nombre}!`);
        onLogin();
      }
    } catch {
      setError("Error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="glass-strong rounded-3xl p-8 neon-glow">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 mb-4">
              <Trophy className="w-10 h-10 text-cyan-400" />
            </div>
            <h1 className="text-3xl font-bold text-gradient">Polla Mundialista</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Registra tus pronosticos para el Mundial 2026
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {step === "user" ? (
              <motion.form
                key="user"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleUsernameSubmit}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Tu nombre
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => {
                        setNombre(e.target.value);
                        setError("");
                      }}
                      placeholder="Escribe tu nombre"
                      className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      disabled={loading}
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
                  disabled={loading || !nombre.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Continuar"
                  )}
                </motion.button>
              </motion.form>
            ) : (
              <motion.form
                key="password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handlePasswordSubmit}
                className="space-y-5"
              >
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {isNewUser ? (
                      <>
                        Creando cuenta para{" "}
                        <span className="text-cyan-400 font-medium">{nombre}</span>
                      </>
                    ) : (
                      <>
                        Bienvenido de nuevo{" "}
                        <span className="text-cyan-400 font-medium">{nombre}</span>
                      </>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("user");
                      setPassword("");
                      setConfirmPassword("");
                      setError("");
                    }}
                    className="text-xs text-muted-foreground hover:text-cyan-400 mt-1 transition-colors"
                  >
                    Cambiar nombre
                  </button>
                </div>

                {isNewUser && (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Foto de perfil (opcional)
                    </label>
                    <div className="flex items-center gap-4">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="relative w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-cyan-500/50 transition-all overflow-hidden group"
                      >
                        {avatarPreview ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={avatarPreview}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAvatarFile(null);
                                setAvatarPreview(null);
                              }}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </>
                        ) : (
                          <Upload className="w-5 h-5 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <p className="text-xs text-muted-foreground">
                        Sube una foto para tu perfil
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      placeholder={isNewUser ? "Crea una contraseña" : "Tu contraseña"}
                      className="w-full pl-11 pr-11 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      disabled={loading}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {isNewUser && (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Confirmar contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setError("");
                        }}
                        placeholder="Repite la contraseña"
                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                        disabled={loading}
                      />
                    </div>
                  </div>
                )}

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
                  disabled={loading || !password}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {isNewUser ? "Creando cuenta..." : "Ingresando..."}
                    </>
                  ) : isNewUser ? (
                    "Crear Cuenta"
                  ) : (
                    "Entrar"
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
