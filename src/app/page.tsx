import { VixoraApp } from "@/components/vixora/VixoraApp";

// Forzar renderizado dinámico — evita que Vercel intente
// pre-renderizar la página durante el build (lo cual fallaba
// porque los componentes cliente importan código que necesita
// variables de entorno de runtime).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return <VixoraApp />;
}
