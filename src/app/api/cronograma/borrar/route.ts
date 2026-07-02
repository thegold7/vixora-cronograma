/**
 * POST /api/cronograma/borrar
 * Elimina una entrada del cronograma.
 * Solo accesible en modo editor.
 *
 * Body: { tecnico_id, fecha }
 */
import { NextRequest, NextResponse } from "next/server";
import { deleteEntradaCronograma } from "@/lib/sheets";
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
    const { tecnico_id, fecha } = body;
    if (!tecnico_id || !fecha) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos: tecnico_id, fecha" },
        { status: 400 }
      );
    }
    await deleteEntradaCronograma(tecnico_id, fecha);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/cronograma/borrar] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
