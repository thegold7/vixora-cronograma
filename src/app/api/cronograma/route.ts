/**
 * POST /api/cronograma
 * Crea o actualiza una entrada del cronograma.
 * Solo accesible en modo editor.
 *
 * Body:
 *   { tecnico_id, fecha, actividad, ots_asignadas, detalle, notas }
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
    if (!tecnico_id || !fecha || !actividad) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos: tecnico_id, fecha, actividad" },
        { status: 400 }
      );
    }
    const result = await upsertEntradaCronograma({
      tecnico_id,
      fecha,
      actividad,
      ots_asignadas: ots_asignadas ?? "—",
      detalle: detalle ?? "",
      notas: notas ?? "",
      modificado_por: "editor",
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error("[/api/cronograma] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
