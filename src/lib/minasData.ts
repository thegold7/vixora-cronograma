// Coordenadas de las principales minas y sedes en Perú
// Formato: { nombre: string, lat: number, lng: number, region: string }

export interface MinaCoord {
  nombre: string;
  lat: number;
  lng: number;
  region: string;
}

// Lista de minas/sedes (normalizadas en MAYÚSCULAS para buscar coincidencias)
export const MINAS_PERU: MinaCoord[] = [
  { nombre: "MARCOBRE", lat: -14.6133, lng: -75.1039, region: "Nazca, Ica" },
  { nombre: "ANTAPACCAY", lat: -14.2833, lng: -71.1833, region: "Espinar, Cusco" },
  { nombre: "ANTAMINA", lat: -9.5667, lng: -77.0667, region: "San Marcos, Ancash" },
  { nombre: "ANTAMINA NUEVO", lat: -9.5667, lng: -77.0667, region: "San Marcos, Ancash" },
  { nombre: "TOROMOCHO", lat: -11.5500, lng: -76.2500, region: "Yauli, Junín" },
  { nombre: "BAMBAS", lat: -14.1500, lng: -72.3500, region: "Cotabambas, Apurímac" },
  { nombre: "CERRO VERDE", lat: -16.3000, lng: -71.6000, region: "Arequipa" },
  { nombre: "CONSTANCIA", lat: -12.8333, lng: -75.8000, region: "Chumbivilcas, Cusco" },
  { nombre: "HUDBAY", lat: -12.8333, lng: -75.8000, region: "Chumbivilcas, Cusco" },
  { nombre: "CUAJONE", lat: -17.0833, lng: -70.8333, region: "Moquegua" },
  { nombre: "QUELLAVECO", lat: -17.0500, lng: -70.7000, region: "Moquegua" },
  { nombre: "PUCAMARCA", lat: -17.2000, lng: -70.4000, region: "Tacna" },
  { nombre: "CERRO LINDO", lat: -15.8167, lng: -74.5000, region: "Chincha, Ica" },
  { nombre: "EL PORVENIR", lat: -14.5000, lng: -75.5000, region: "Ica" },
  { nombre: "COBRIZA", lat: -13.5000, lng: -73.5000, region: "Huancavelica" },
  { nombre: "SAN GABRIEL", lat: -15.5000, lng: -72.0000, region: "Arequipa" },
  { nombre: "RAURA", lat: -10.5000, lng: -76.7000, region: "Oyón, Lima" },
  { nombre: "CHORRILLOS", lat: -12.2000, lng: -77.0000, region: "Lima" },
  { nombre: "GAMBETTA", lat: -12.0500, lng: -77.1000, region: "Callao" },
  { nombre: "INDUSTRIAL", lat: -12.0000, lng: -77.0000, region: "Lima" },
  { nombre: "CUSCO", lat: -13.5319, lng: -71.9675, region: "Cusco" },
  { nombre: "AREQUIPA", lat: -16.3989, lng: -71.5350, region: "Arequipa" },
  { nombre: "HUARAZ", lat: -9.5278, lng: -77.5278, region: "Ancash" },
  { nombre: "HUANCAYO", lat: -12.0673, lng: -75.2100, region: "Junín" },
  { nombre: "TRUJILLO", lat: -8.1116, lng: -79.0288, region: "La Libertad" },
  { nombre: "ICA", lat: -14.0678, lng: -75.7286, region: "Ica" },
  { nombre: "LIMA", lat: -12.0464, lng: -77.0428, region: "Lima" },
  { nombre: "CHILE", lat: -33.4489, lng: -70.6693, region: "Santiago, Chile" },
  { nombre: "LURIN", lat: -12.2500, lng: -76.8667, region: "Lima" },
  { nombre: "CARAVELI", lat: -15.7833, lng: -73.3667, region: "Arequipa" },
];

// Función para buscar coordenada por sede
export function findMinaCoord(sede: string): MinaCoord | null {
  if (!sede) return null;
  const sedeUpper = sede.toUpperCase().trim();
  
  // 1. Coincidencia exacta
  let found = MINAS_PERU.find(m => m.nombre === sedeUpper);
  if (found) return found;
  
  // 2. Coincidencia parcial (si la sede incluye el nombre de la mina)
  found = MINAS_PERU.find(m => sedeUpper.includes(m.nombre));
  if (found) return found;
  
  // 3. Búsqueda inversa (si el nombre de la mina incluye la sede)
  found = MINAS_PERU.find(m => m.nombre.includes(sedeUpper));
  if (found) return found;
  
  return null;
}
