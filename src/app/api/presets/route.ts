/**
 * GET /api/presets
 *   Devuelve todos los presets de sedes con sus documentos y sub-documentos.
 *
 * POST /api/presets
 *   Acciones:
 *     - { accion: "agregar_sede", sede_nombre }
 *     - { accion: "eliminar_sede", id }
 *     - { accion: "agregar_documento", presetSedeId, documento }
 *     - { accion: "eliminar_documento", id }
 *     - { accion: "agregar_subdoc", presetDocId, sub }
 *     - { accion: "eliminar_subdoc", id }
 *     - { accion: "sincronizar", presets }
 *     - { accion: "aplicar_a_tecnico", presetSedeId, tecnicoId, copiarFechas }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getPresetsSedes,
  addPresetSede,
  deletePresetSede,
  addPresetDocumento,
  deletePresetDocumento,
  addPresetSubDoc,
  deletePresetSubDoc,
  replaceAllPresetsSedes,
  addHabilitacion,
} from "@/lib/sheets";
import { isEditor } from "@/lib/auth";
import type { PresetSede, PresetDocumento, SubDocumento, Habilitacion } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const presets = await getPresetsSedes();
    return NextResponse.json({ ok: true, data: presets });
  } catch (err) {
    console.error("[/api/presets GET] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

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

    // ---------- AGREGAR SEDE PRESET ----------
    if (accion === "agregar_sede") {
      const { sede_nombre } = body;
      if (!sede_nombre) {
        return NextResponse.json(
          { ok: false, error: "Falta campo: sede_nombre" },
          { status: 400 }
        );
      }
      const result = await addPresetSede(sede_nombre);
      return NextResponse.json({ ok: true, data: { id: result.id } });
    }

    // ---------- ELIMINAR SEDE PRESET ----------
    if (accion === "eliminar_sede") {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "Falta campo: id" },
          { status: 400 }
        );
      }
      await deletePresetSede(id);
      return NextResponse.json({ ok: true });
    }

    // ---------- AGREGAR DOCUMENTO A PRESET ----------
    if (accion === "agregar_documento") {
      const { presetSedeId, documento } = body;
      if (!presetSedeId || !documento) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: presetSedeId, documento" },
          { status: 400 }
        );
      }
      const result = await addPresetDocumento(presetSedeId, documento as Omit<PresetDocumento, "id">);
      return NextResponse.json({ ok: true, data: { id: result.id } });
    }

    // ---------- ELIMINAR DOCUMENTO DE PRESET ----------
    if (accion === "eliminar_documento") {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "Falta campo: id" },
          { status: 400 }
        );
      }
      await deletePresetDocumento(id);
      return NextResponse.json({ ok: true });
    }

    // ---------- AGREGAR SUB-DOCUMENTO A PRESET ----------
    if (accion === "agregar_subdoc") {
      const { presetDocId, sub } = body;
      if (!presetDocId || !sub) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: presetDocId, sub" },
          { status: 400 }
        );
      }
      const result = await addPresetSubDoc(presetDocId, sub as Omit<SubDocumento, "id">);
      return NextResponse.json({ ok: true, data: { id: result.id } });
    }

    // ---------- ELIMINAR SUB-DOCUMENTO DE PRESET ----------
    if (accion === "eliminar_subdoc") {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "Falta campo: id" },
          { status: 400 }
        );
      }
      await deletePresetSubDoc(id);
      return NextResponse.json({ ok: true });
    }

    // ---------- SINCRONIZAR TODO ----------
    if (accion === "sincronizar") {
      const { presets } = body;
      if (!Array.isArray(presets)) {
        return NextResponse.json(
          { ok: false, error: "Formato inválido: se esperaba array de presets" },
          { status: 400 }
        );
      }
      await replaceAllPresetsSedes(presets as PresetSede[]);
      return NextResponse.json({ ok: true, data: { count: presets.length } });
    }

    // ---------- APLICAR PRESET A TÉCNICO ----------
    // Crea habilitaciones en base a los documentos del preset.
    // Si copiarFechas=false, no se copian las fechas (solo estructura).
    if (accion === "aplicar_a_tecnico") {
      const { presetSedeId, tecnicoId, copiarFechas } = body;
      if (!presetSedeId || !tecnicoId) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: presetSedeId, tecnicoId" },
          { status: 400 }
        );
      }
      const allPresets = await getPresetsSedes();
      const preset = allPresets.find(p => p.id === presetSedeId);
      if (!preset) {
        return NextResponse.json(
          { ok: false, error: `Preset ${presetSedeId} no encontrado` },
          { status: 404 }
        );
      }

      let creadas = 0;
      for (const doc of preset.documentos) {
        const nuevaHab: Omit<Habilitacion, "id"> = {
          tecnico_id: tecnicoId,
          sede_nombre: preset.sede_nombre,
          documento_nombre: doc.nombre,
          fecha_vencimiento: copiarFechas ? (doc.fecha_vencimiento || undefined) : undefined,
          enlace_url: doc.enlace_url,
          notas: doc.notas,
          sub_documentos: doc.sub_documentos?.map(s => ({
            id: "",
            nombre: s.nombre,
            fecha_vencimiento: copiarFechas ? s.fecha_vencimiento : "",
            enlace_url: s.enlace_url,
            notas: s.notas,
            contabilizar: s.contabilizar,
          })),
        };
        await addHabilitacion(nuevaHab);
        creadas++;
      }
      return NextResponse.json({ ok: true, data: { creadas } });
    }

    return NextResponse.json(
      { ok: false, error: "Acción no reconocida. Usa: agregar_sede, eliminar_sede, agregar_documento, eliminar_documento, agregar_subdoc, eliminar_subdoc, sincronizar, aplicar_a_tecnico" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[/api/presets POST] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
