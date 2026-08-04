/**
 * POST /api/cronograma
 * Crea o actualiza una entrada del cronograma.
 * FIX: Manejo robusto de errores + logging + validaciones.
 */
import { NextRequest, NextResponse } from "next/server";
import { upsertEntradaCronograma } from "@/lib/sheets";
import { isEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isEditor())) {
    return NextResponse.json(
      { ok: false, error: "No autorizado. Se requiere modo editor." },
      { status: 403 }
    );
  }
  try {
    const body = await req.json();
    const { tecnico_id, fecha, actividad, ots_asignadas, detalle, notas } = body;

    // FIX: Validaciones estrictas
    if (!tecnico_id || typeof tecnico_id !== "string") {
      return NextResponse.json(
        { ok: false, error: "tecnico_id es obligatorio y debe ser string" },
        { status: 400 }
      );
    }
    if (!fecha || typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json(
        { ok: false, error: "fecha es obligatoria y debe tener formato YYYY-MM-DD" },
        { status: 400 }
      );
    }
    if (!actividad || typeof actividad !== "string") {
      return NextResponse.json(
        { ok: false, error: "actividad es obligatoria" },
        { status: 400 }
      );
    }

    // FIX: Si actividad es "DESCANSO" o similar (sin OTs), aseguramos que ots_asignadas sea "—"
    const actividadesSinOt = ["DESCANSO", "FIN DE SEMANA", "DESCANSO PROY.", "DESCANSO MC", "DESCANSO ANT", "DESC.MÉDICO", "PERMISO", "CURSOS", "VACACIONES", "FERIADO", "MOVILIZACIÓN"];
    let finalOts = ots_asignadas;
    let finalDetalle = detalle;
    if (actividadesSinOt.includes(actividad.toUpperCase())) {
      finalOts = "—";
      finalDetalle = detalle || "—";
    }

    const result = await upsertEntradaCronograma({
      tecnico_id,
      fecha,
      actividad,
      ots_asignadas: finalOts || "—",
      detalle: finalDetalle || "—",
      notas: notas || "",
      modificado_por: "editor",
    });

    return NextResponse.json({ ok: true, data: { id: result.id } });
  } catch (err) {
    // FIX: Log detallado para diagnóstico
    console.error("[/api/cronograma POST] ERROR:", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
