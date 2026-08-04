/**
 * POST /api/cronograma/borrar
 * Acciones:
 *   - { tecnico_id, fecha } → borra una sola entrada (atomic)
 *   - { accion: "rango", tecnico_id, fechaInicio, fechaFin } → borra múltiples entradas (batch)
 *
 * FIX: Manejo robusto de errores + logging + safeguard anti-borrado masivo.
 */
import { NextRequest, NextResponse } from "next/server";
import { deleteEntradaCronograma, deleteEntradasRango } from "@/lib/sheets";
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
    const { accion } = body;

    // ---------- BORRAR UNA SOLA ENTRADA ----------
    if (!accion) {
      const { tecnico_id, fecha } = body;
      if (!tecnico_id || !fecha) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: tecnico_id, fecha" },
          { status: 400 }
        );
      }
      await deleteEntradaCronograma(tecnico_id, fecha);
      return NextResponse.json({ ok: true, data: { deleted: 1 } });
    }

    // ---------- BORRAR RANGO (BATCH) ----------
    if (accion === "rango") {
      const { tecnico_id, fechaInicio, fechaFin } = body;
      if (!tecnico_id || !fechaInicio || !fechaFin) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: tecnico_id, fechaInicio, fechaFin" },
          { status: 400 }
        );
      }

      // Calcular todas las fechas del rango
      const inicio = new Date(fechaInicio + "T00:00:00");
      const fin = new Date(fechaFin + "T00:00:00");
      const fechas: string[] = [];
      const actual = new Date(inicio);
      while (actual <= fin) {
        const y = actual.getFullYear();
        const m = String(actual.getMonth() + 1).padStart(2, "0");
        const d = String(actual.getDate()).padStart(2, "0");
        fechas.push(`${y}-${m}-${d}`);
        actual.setDate(actual.getDate() + 1);
      }

      // Llamar a la función batch con safeguard (max 100)
      const result = await deleteEntradasRango(tecnico_id, fechas);
      return NextResponse.json({ ok: true, data: { deleted: result.deleted } });
    }

    return NextResponse.json(
      { ok: false, error: "Acción no reconocida. Usa: (sin accion) o accion: 'rango'" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[/api/cronograma/borrar POST] ERROR:", {
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
