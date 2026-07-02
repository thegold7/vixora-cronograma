"use client";

import { useStore } from "@/lib/store";
import { UserCircle, Eye, EyeOff } from "lucide-react";
import type { Tecnico } from "@/lib/types";

interface Props {
  tecnicos: Tecnico[];
  modoAcceso: "lector" | "editor";
}

export function TecnicosManager({ tecnicos, modoAcceso }: Props) {
  const { toggleTecnico } = useStore();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Gestión de Técnicos</h2>
        <p className="text-sm text-gray-500 mt-1">
          Activa o desactiva técnicos. Los inactivos no aparecen en el cronograma
          pero su información se conserva en el Excel.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">ID</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Nombre</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Cargo</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Correo</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Código SAP</th>
              <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Estado</th>
              {modoAcceso === "editor" && (
                <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Acción</th>
              )}
            </tr>
          </thead>
          <tbody>
            {tecnicos.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 text-xs font-mono text-gray-500">{t.id}</td>
                <td className="px-4 py-2 text-xs font-semibold text-gray-900 flex items-center gap-2">
                  <UserCircle size={20} className="text-gray-400" />
                  {t.nombre}
                </td>
                <td className="px-4 py-2 text-xs text-gray-600">{t.cargo}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{t.correo}</td>
                <td className="px-4 py-2 text-xs text-gray-500 font-mono">{t.codigo_sap}</td>
                <td className="px-4 py-2 text-center">
                  {t.activo ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                      Inactivo
                    </span>
                  )}
                </td>
                {modoAcceso === "editor" && (
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => toggleTecnico(t.id, !t.activo)}
                      className={`px-2 py-1 text-[10px] font-semibold rounded ${
                        t.activo
                          ? "bg-red-50 text-red-700 hover:bg-red-100"
                          : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {t.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modoAcceso !== "editor" && (
        <p className="text-xs text-gray-400 mt-3 italic">
          Entra como editor para activar/desactivar técnicos.
        </p>
      )}
    </div>
  );
}
