/**
 * GET /api/data
 * Devuelve TODOS los datos necesarios para renderizar la app:
 *   - tecnicos (activos + inactivos)
 *   - ots (todas las OTs con visible_mapa)
 *   - actividades (con colores)
 *   - cronograma (mapa)
 *   - modoAcceso (lector | editor)
 */
import { NextResponse } from "next/server";
import {
  getTecnicos,
  getOTs,
  getActividades,
  getCronogramaMap,
} from "@/lib/sheets";
import { getModoAcceso } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [tecnicos, allOts, actividades, cronograma, modoAcceso] = await Promise.all([
      getTecnicos(),
      getOTs(),
      getActividades(),
      getCronogramaMap(),
      getModoAcceso(),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        tecnicos,
        ots: allOts,
        actividades,
        cronograma,
        modoAcceso,
      },
    });
  } catch (err) {
    console.error("[/api/data] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
