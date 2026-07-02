"use client";

import { useStore } from "@/lib/store";
import { Search, Plus, X, CheckSquare, Filter } from "lucide-react";
import { useState } from "react";
import type { OT } from "@/lib/types";

interface Props {
  ots: OT[];
  modoAcceso: "lector" | "editor";
}

export function SidebarRight({ ots, modoAcceso }: Props) {
  const { otSeleccionadas, toggleOTSeleccionada, limpiarOTsSeleccionadas, showToast, abrirModalEdicion, seleccionRango } = useStore();
  const [query, setQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "EN PROCESO" | "PENDIENTE">("todos");

  const otsFiltradas = ots.filter((o) => {
    if (filtroEstado !== "todos" && o.estado !== filtroEstado) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      o.codigo.toLowerCase().includes(q) ||
      o.cliente.toLowerCase().includes(q) ||
      o.sede.toLowerCase().includes(q)
    );
  });

  const handleDragStart = (e: React.DragEvent, codigos: string[]) => {
    e.dataTransfer.setData("text/plain", JSON.stringify(codigos));
    e.dataTransfer.effectAllowed = "copy";
  };

  const seleccionarTodas = () => {
    if (otSeleccionadas.length === otsFiltradas.length) {
      limpiarOTsSeleccionadas();
    } else {
      // limpiar y agregar todas las visibles
      otsFiltradas.forEach((o) => {
        if (!otSeleccionadas.includes(o.codigo)) {
          toggleOTSeleccionada(o.codigo);
        }
      });
    }
  };

  const todasSeleccionadas =
    otsFiltradas.length > 0 &&
    otsFiltradas.every((o) => otSeleccionadas.includes(o.codigo));

  return (
    <aside className="w-72 shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-white">
        <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
          Gestión de Asignaciones
        </div>
        <div className="text-[10px] text-gray-500">
          {modoAcceso === "editor"
            ? "Arrastra OTs a una celda o selecciónalas y haz click en una celda"
            : "Solo lectura — entra como editor para asignar"}
        </div>
      </div>

      {/* Asignación masiva al rango */}
      {seleccionRango.inicio && seleccionRango.fin && modoAcceso === "editor" && (
        <div className="p-3 bg-pink-50 border-b border-pink-200">
          <div className="text-[10px] font-bold text-pink-700 uppercase mb-1">
            Rango seleccionado
          </div>
          <div className="text-xs text-pink-900 mb-2">
            {seleccionRango.inicio} → {seleccionRango.fin}
          </div>
          <div className="text-[10px] text-pink-700">
            {otSeleccionadas.length} OT(s) seleccionada(s)
          </div>
          {otSeleccionadas.length > 0 && (
            <div className="text-[10px] text-gray-500 mt-1 italic">
              Abre cualquier celda del rango para asignar masivamente.
            </div>
          )}
        </div>
      )}

      {/* Búsqueda */}
      <div className="p-3 border-b border-gray-200 bg-white">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar OT..."
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-pink-400"
          />
        </div>
      </div>

      {/* Filtros estado */}
      <div className="p-2 border-b border-gray-200 bg-white flex gap-1">
        <FilterChip
          active={filtroEstado === "todos"}
          onClick={() => setFiltroEstado("todos")}
          label="Todas"
          color="gray"
        />
        <FilterChip
          active={filtroEstado === "EN PROCESO"}
          onClick={() => setFiltroEstado("EN PROCESO")}
          label="En curso"
          color="yellow"
        />
        <FilterChip
          active={filtroEstado === "PENDIENTE"}
          onClick={() => setFiltroEstado("PENDIENTE")}
          label="Planificadas"
          color="blue"
        />
      </div>

      {/* Seleccionar todas */}
      <div className="px-3 py-2 border-b border-gray-200 bg-white flex items-center justify-between">
        <button
          onClick={seleccionarTodas}
          className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-pink-600"
        >
          <CheckSquare size={12} />
          {todasSeleccionadas ? "Quitar todas" : "Seleccionar todas"}
        </button>
        {otSeleccionadas.length > 0 && (
          <button
            onClick={limpiarOTsSeleccionadas}
            className="text-[11px] text-gray-400 hover:text-red-500"
          >
            Limpiar ({otSeleccionadas.length})
          </button>
        )}
      </div>

      {/* Lista de OTs */}
      <div className="flex-1 overflow-y-auto">
        {otsFiltradas.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-400">
            No hay OTs que coincidan
          </div>
        ) : (
          otsFiltradas.map((o) => {
            const sel = otSeleccionadas.includes(o.codigo);
            return (
              <div
                key={o.codigo}
                draggable={modoAcceso === "editor"}
                onDragStart={(e) => handleDragStart(e, [o.codigo])}
                onClick={() => modoAcceso === "editor" && toggleOTSeleccionada(o.codigo)}
                className={`p-2 border-b border-gray-100 cursor-pointer transition-colors ${
                  sel ? "bg-pink-50 border-l-2 border-l-pink-500" : "hover:bg-gray-100"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`mt-0.5 w-3 h-3 rounded border ${
                      sel
                        ? "bg-pink-500 border-pink-500"
                        : "border-gray-300"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-900">
                      {o.codigo}
                    </div>
                    <div className="text-[11px] text-gray-600 truncate">
                      {o.cliente}
                    </div>
                    {o.sede && (
                      <div className="text-[10px] text-gray-400 truncate">
                        {o.sede}
                      </div>
                    )}
                  </div>
                  <EstadoBadge estado={o.estado} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer informativo */}
      <div className="p-2 border-t border-gray-200 bg-white text-[10px] text-gray-400 text-center">
        {otsFiltradas.length} OT(s) mostradas
      </div>
    </aside>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: "gray" | "yellow" | "blue";
}) {
  const colors = {
    gray: active ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600",
    yellow: active ? "bg-yellow-500 text-white" : "bg-yellow-50 text-yellow-700",
    blue: active ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700",
  };
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1 text-[10px] rounded font-medium ${colors[color]}`}
    >
      {label}
    </button>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const color =
    estado === "EN PROCESO"
      ? "bg-yellow-100 text-yellow-700"
      : estado === "PENDIENTE"
      ? "bg-blue-100 text-blue-700"
      : estado === "FINALIZADO"
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${color}`}>
      {estado.slice(0, 3)}
    </span>
  );
}
