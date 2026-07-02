/**
 * POST /api/cronograma/visual
 * Regenera la hoja Cronograma_Visual (matriz 365 días) desde _Cronograma_Datos.
 * Solo accesible en modo editor.
 *
 * Body: { year: number, month?: number }
 *   - Si month viene, regenera solo ese mes (más rápido).
 *   - Si no, regenera todo el año.
 */
import { NextRequest, NextResponse } from "next/server";
import { regenerarCronogramaVisual } from "@/lib/sheets";
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
    const { year, month } = body;
    if (!year || typeof year !== "number") {
      return NextResponse.json(
        { ok: false, error: "Falta year (number)" },
        { status: 400 }
      );
    }
    const result = await regenerarCronogramaVisual(
      year,
      typeof month === "number" ? month : undefined
    );
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error("[/api/cronograma/visual] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
