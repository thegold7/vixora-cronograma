/**
 * GET /api/data
 * Devuelve TODOS los datos necesarios para renderizar la app:
 *   - tecnicos
 *   - ots (deduplicadas + defaults aplicados)
 *   - actividades
 *   - cronograma
 *   - sedes (auto-creadas si hay nuevas en OTs)
 *   - modoAcceso
 */
import { NextResponse } from "next/server";
import {
  getTecnicos,
  getOTs,
  getActividades,
  getCronogramaMap,
  getSedes,
  autoCreateMissingSedes,
} from "@/lib/sheets";
import { getModoAcceso } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // FIX: leer OTs primero (con deduplicación y defaults)
    const allOts = await getOTs();

    // FIX: obtener sedes actuales
    const sedesActuales = await getSedes();

    // FIX: Auto-crear sedes faltantes en base a las OTs
    // Esto asegura que toda OT tenga su sede en la hoja Sedes (sin duplicados)
    const sedesFinales = await autoCreateMissingSedes(allOts, sedesActuales);

    const [tecnicos, actividades, cronograma, modoAcceso] = await Promise.all([
      getTecnicos(),
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
        sedes: sedesFinales,
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
