"use client";

import { useStore } from "@/lib/store";
import { X, Lock } from "lucide-react";
import { useState } from "react";

export function LoginModal() {
  const { loginModalAbierto, setLoginModalAbierto, login, showToast } = useStore();
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

  if (!loginModalAbierto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setCargando(true);
    const ok = await login(password);
    setCargando(false);
    if (ok) {
      setPassword("");
      setLoginModalAbierto(false);
      showToast("Modo editor activado", "ok");
    } else {
      showToast("Contraseña incorrecta", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => setLoginModalAbierto(false)}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-[90%] max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 flex items-center justify-between text-white"
          style={{ backgroundColor: "#1d1d1f" }}
        >
          <div className="flex items-center gap-2">
            <Lock size={16} />
            <span className="text-sm font-bold">Acceso de editor</span>
          </div>
          <button
            onClick={() => setLoginModalAbierto(false)}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
              Contraseña de editor
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder="Ingresa la contraseña compartida"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-pink-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Esta contraseña es compartida entre editores autorizados.
            </p>
          </div>
          <button
            type="submit"
            disabled={cargando}
            className="w-full py-2 text-sm text-white rounded font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#E91E63" }}
          >
            {cargando ? "Verificando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
