/**
 * Auth simple basado en cookies + contraseña compartida.
 * Modo lector: sin contraseña, URL pública.
 * Modo editor: requiere contraseña VIXORA_EDITOR_PASSWORD.
 */
import { cookies } from "next/headers";

const EDITOR_PASSWORD = process.env.VIXORA_EDITOR_PASSWORD ?? "Vixora2026!Editor";
const COOKIE_NAME = "vixora_editor_auth";

export function getEditorPassword(): string {
  return EDITOR_PASSWORD;
}

export function isValidEditorPassword(pw: string): boolean {
  return pw === EDITOR_PASSWORD;
}

/** Verifica si la cookie actual indica sesión de editor (server-side, async) */
export async function isEditor(): Promise<boolean> {
  const store = await cookies();
  const v = store.get(COOKIE_NAME)?.value;
  return v === "1";
}

export async function getModoAcceso(): Promise<"lector" | "editor"> {
  return (await isEditor()) ? "editor" : "lector";
}

export const AUTH_COOKIE = COOKIE_NAME;
