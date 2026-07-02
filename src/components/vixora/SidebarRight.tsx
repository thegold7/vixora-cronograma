"use client";

import { useStore } from "@/lib/store";
import { Search, Plus, X, CheckSquare, PanelRightClose, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useMemo } from "react";
import type { OT } from "@/lib/types";

interface Props {
  ots: OT[];
  modoAcceso: "lector" | "editor";
}

export function SidebarRight({ ots, modoAcceso }: Props) {
  const {
    otSeleccionadas,
    toggleOTSeleccionada,
    limpiarOTsSeleccionadas,
    seleccionRango,
    setSeleccionRango,
    cambiarEstadoOt,
    agregarOt,
    showToast,
    sidebarDerechaVisible,
    toggleSidebarDerecha,
  } = useStore();

  const [query, setQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "EN PROCESO" | "FINALIZADO">("todos");
  const [otExpandida, setOtExpandida] = useState<string | null>(null);
  const [mostrarFormNueva, setMostrarFormNueva] = useState(false);
  const [nuevaOt, setNuevaOt] = useState({ codigo: "", cliente: "", sede: "", estado: "EN PROCESO" });

  const otsFiltradas = useMemo(() => {
    return ots.filter((o) => {
      if (filtroEstado !== "todos" && o.estado !== filtroEstado) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        o.codigo.toLowerCase().includes(q) ||
        o.cliente.toLowerCase().includes(q) ||
        o.sede.toLowerCase().includes(q)
      );
    });
  }, [ots, query, filtroEstado]);

  const handleDragStart = (e: React.DragEvent, codigos: string[]) => {
    e.dataTransfer.setData("text/plain", JSON.stringify(codigos));
    e.dataTransfer.effectAllowed = "copy";
  };

  const seleccionarTodas = () => {
    if (otSeleccionadas.length === otsFiltradas.length) {
      limpiarOTsSeleccionadas();
    } else {
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

  if (!sidebarDerechaVisible) {
    return (
      <button
        onClick={toggleSidebarDerecha}
        className="w-8 shrink-0 border-l border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center"
        title="Mostrar panel de OTs"
      >
        <PanelRightClose size={16} className="rotate-180" />
      </button>
    );
  }

  return (
    <aside className="w-64 shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col">
      <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          Gestión de Asignaciones
        </div>
        <button
          onClick={toggleSidebarDerecha}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
          title="Ocultar panel"
        >
          <PanelRightClose size={14} />
        </button>
      </div>

      {seleccionRango.inicio && seleccionRango.fin && (
        <div className="p-3 bg-pink-50 border-b border-pink-200">
          <div className="text-[10px] font-bold text-pink-700 uppercase mb-1">
            📅 Rango seleccionado
          </div>
          <div className="text-xs text-pink-900 font-semibold">
            {formatearFechaCorta(seleccionRango.inicio)} → {formatearFechaCorta(seleccionRango.fin)}
          </div>
          <div className="text-[10px] text-pink-700 mt-1">
            {otSeleccionadas.length} OT(s) seleccionada(s)
          </div>
          <button
            onClick={() => setSeleccionRango({ inicio: null, fin: null })}
            className="mt-1 text-[10px] text-pink-700 hover:underline"
          >
            ✕ Limpiar rango
          </button>
        </div>
      )}

      <div className="p-2 border-b border-gray-200 bg-white">
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
          active={filtroEstado === "FINALIZADO"}
          onClick={() => setFiltroEstado("FINALIZADO")}
          label="Finalizadas"
          color="green"
        />
      </div>

      <div className="px-2 py-2 border-b border-gray-200 bg-white flex items-center justify-between">
        <button
          onClick={seleccionarTodas}
          className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-pink-600"
        >
          <CheckSquare size={12} />
          {todasSeleccionadas ? "Quitar todas" : "Todas"}
        </button>
        {otSeleccionadas.length > 0 && (
          <button
            onClick={limpiarOTsSeleccionadas}
            className="text-[11px] text-gray-400 hover:text-red-500"
          >
            Limpiar ({otSeleccionadas.length})
          </button>
        )}
        {modoAcceso === "editor" && (
          <button
            onClick={() => setMostrarFormNueva(!mostrarFormNueva)}
            className="text-[11px] text-pink-600 hover:text-pink-700 flex items-center gap-1"
            title="Agregar nueva OT"
          >
            <Plus size={12} />
            Nueva
          </button>
        )}
      </div>

      {mostrarFormNueva && modoAcceso === "editor" && (
        <div className="p-2 border-b border-gray-200 bg-pink-50 space-y-1">
          <input
            type="text"
            value={nuevaOt.codigo}
            onChange={(e) => setNuevaOt({ ...nuevaOt, codigo: e.target.value })}
            placeholder="Código OT"
            className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded"
          />
          <input
            type="text"
            value={nuevaOt.cliente}
            onChange={(e) => setNuevaOt({ ...nuevaOt, cliente: e.target.value })}
            placeholder="Cliente"
            className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded"
          />
          <input
            type="text"
            value={nuevaOt.sede}
            onChange={(e) => setNuevaOt({ ...nuevaOt, sede: e.target.value })}
            placeholder="Sede (opcional)"
            className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded"
          />
          <select
            value={nuevaOt.estado}
            onChange={(e) => setNuevaOt({ ...nuevaOt, estado: e.target.value })}
            className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded"
          >
            <option value="EN PROCESO">EN PROCESO</option>
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="FINALIZADO">FINALIZADO</option>
          </select>
          <button
            onClick={async () => {
              if (!nuevaOt.codigo || !nuevaOt.cliente) {
                showToast("Código y cliente son obligatorios", "error");
                return;
              }
              const ok = await agregarOt(nuevaOt.codigo, nuevaOt.cliente, nuevaOt.sede, nuevaOt.estado);
              if (ok) {
                setNuevaOt({ codigo: "", cliente: "", sede: "", estado: "EN PROCESO" });
                setMostrarFormNueva(false);
              }
            }}
            className="w-full py-1 text-[11px] text-white rounded bg-pink-600 hover:bg-pink-700"
          >
            Agregar OT
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {otsFiltradas.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-400">
            No hay OTs que coincidan
          </div>
        ) : (
          otsFiltradas.map((o) => {
            const sel = otSeleccionadas.includes(o.codigo);
            const expanded = otExpandida === o.codigo;
            return (
              <div
                key={o.codigo}
                draggable={modoAcceso === "editor"}
                onDragStart={(e) => handleDragStart(e, [o.codigo])}
                className={`border-b border-gray-100 ${sel ? "bg-pink-50" : "hover:bg-gray-100"}`}
              >
                <div
                  onClick={() => modoAcceso === "editor" && toggleOTSeleccionada(o.codigo)}
                  className="p-2 cursor-pointer"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-0.5 w-3 h-3 rounded border shrink-0 ${
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
                    {modoAcceso === "editor" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOtExpandida(expanded ? null : o.codigo);
                        }}
                        className="p-0.5 text-gray-400 hover:text-gray-700"
                        title="Opciones"
                      >
                        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>
                </div>
                {expanded && modoAcceso === "editor" && (
                  <div className="px-2 pb-2 bg-gray-50 border-t border-gray-100">
                    <div className="text-[10px] text-gray-500 mb-1 mt-1">Cambiar estado:</div>
                    <div className="flex gap-1 flex-wrap">
                      {["EN PROCESO", "PENDIENTE", "FINALIZADO", "PERDIDO"].map((est) => (
                        <button
                          key={est}
                          onClick={(e) => {
                            e.stopPropagation();
                            cambiarEstadoOt(o.codigo, est);
                            setOtExpandida(null);
                          }}
                          className={`px-1.5 py-0.5 text-[9px] rounded font-semibold border ${
                            o.estado === est
                              ? "bg-gray-800 text-white border-gray-800"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {est}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

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
  color: "gray" | "yellow" | "green";
}) {
  const colors = {
    gray: active ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600",
    yellow: active ? "bg-yellow-500 text-white" : "bg-yellow-50 text-yellow-700",
    green: active ? "bg-green-600 text-white" : "bg-green-50 text-green-700",
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

function formatearFechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}
