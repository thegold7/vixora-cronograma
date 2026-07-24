/**
 * GET /api/data
 * Devuelve TODOS los datos necesarios para renderizar la app:
 *   - tecnicos
 *   - ots
 *   - actividades
 *   - cronograma
 *   - sedes          ← NUEVO: para que el mapa y el admin compartan la misma fuente
 *   - modoAcceso
 */
import { NextResponse } from "next/server";
import {
  getTecnicos,
  getOTs,
  getActividades,
  getCronogramaMap,
  getSedes,
} from "@/lib/sheets";
import { getModoAcceso } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [tecnicos, allOts, actividades, cronograma, sedes, modoAcceso] = await Promise.all([
      getTecnicos(),
      getOTs(),
      getActividades(),
      getCronogramaMap(),
      getSedes(),
      getModoAcceso(),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        tecnicos,
        ots: allOts,
        actividades,
        cronograma,
        sedes,             // ← NUEVO
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
