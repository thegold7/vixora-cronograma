// Coordenadas de las principales minas y sedes en Perú
export interface MinaCoord {
  nombre: string;
  lat: number;
  lng: number;
  region: string;
  ciudad: string;
  datoCurioso: string;
}

export const MINAS_PERU: MinaCoord[] = [
  { nombre: "MARCOBRE", lat: -14.6133, lng: -75.1039, region: "Nazca, Ica", ciudad: "Nazca", datoCurioso: "Famosa por las Líneas de Nazca, geoglifos milenarios visibles desde el aire, declaradas Patrimonio de la Humanidad por la UNESCO en 1994." },
  { nombre: "ANTAPACCAY", lat: -14.2833, lng: -71.1833, region: "Espinar, Cusco", ciudad: "Espinar", datoCurioso: "Ubicada a más de 4,000 msnm en la sierra sur del Perú, es una zona de gran tradición ganadera y minera." },
  { nombre: "ANTAMINA", lat: -9.5667, lng: -77.0667, region: "San Marcos, Ancash", ciudad: "Huari", datoCurioso: "Una de las minas de cobre más grandes del mundo, opera a 4,300 msnm en la Cordillera de los Andes." },
  { nombre: "ANTAMINA NUEVO", lat: -9.5667, lng: -77.0667, region: "San Marcos, Ancash", ciudad: "Huari", datoCurioso: "Una de las minas de cobre más grandes del mundo, opera a 4,300 msnm en la Cordillera de los Andes." },
  { nombre: "TOROMOCHO", lat: -11.5500, lng: -76.2500, region: "Yauli, Junín", ciudad: "La Oroya", datoCurioso: "La ciudad de La Oroya es históricamente conocida por su complejo metalúrgico, uno de los más importantes del país." },
  { nombre: "BAMBAS", lat: -14.1500, lng: -72.3500, region: "Cotabambas, Apurímac", ciudad: "Cotabambas", datoCurioso: "El proyecto minero Las Bambas es uno de los mayores productores de cobre del Perú, generando desarrollo en la región de Apurímac." },
  { nombre: "CERRO VERDE", lat: -16.3000, lng: -71.6000, region: "Arequipa", ciudad: "Arequipa", datoCurioso: "Arequipa, la 'Ciudad Blanca', es el centro económico del sur del Perú, famosa por su centro histórico construido con sillar volcánico." },
  { nombre: "CONSTANCIA", lat: -12.8333, lng: -75.8000, region: "Chumbivilcas, Cusco", ciudad: "Chumbivilcas", datoCurioso: "Región de tradiciones ancestrales, famosa por el 'Takanakuy', una festividad donde se resuelven conflictos mediante peleas amistosas." },
  { nombre: "HUDBAY", lat: -12.8333, lng: -75.8000, region: "Chumbivilcas, Cusco", ciudad: "Chumbivilcas", datoCurioso: "Región de tradiciones ancestrales, famosa por el 'Takanakuy', una festividad donde se resuelven conflictos mediante peleas amistosas." },
  { nombre: "CUAJONE", lat: -17.0833, lng: -70.8333, region: "Moquegua", ciudad: "Moquegua", datoCurioso: "Moquegua es famosa por sus vides y su tradicional piscos y vinos, además de su架构 colonial y costas pacíficas." },
  { nombre: "QUELLAVECO", lat: -17.0500, lng: -70.7000, region: "Moquegua", ciudad: "Moquegua", datoCurioso: "Moquegua es famosa por sus vides y su tradicional piscos y vinos, además de su架构 colonial y costas pacíficas." },
  { nombre: "PUCAMARCA", lat: -17.2000, lng: -70.4000, region: "Tacna", ciudad: "Tacna", datoCurioso: "Tacna, la 'Ciudad Heroica', es conocida por su patriotismo y su excelente gastronomía, especialmente sus picantes." },
  { nombre: "CERRO LINDO", lat: -15.8167, lng: -74.5000, region: "Chincha, Ica", ciudad: "Chincha", datoCurioso: "Chincha es la cuna del arte afroperuano, famosa por su música, danzas como el festejo y su rica tradición culinaria." },
  { nombre: "EL PORVENIR", lat: -14.5000, lng: -75.5000, region: "Ica", ciudad: "Ica", datoCurioso: "Ica es el principal productor de pisco y vinos del Perú, además de hogar de las oasis de Huacachina." },
  { nombre: "COBRIZA", lat: -13.5000, lng: -73.5000, region: "Huancavelica", ciudad: "Huancavelica", datoCurioso: "Huancavelica fue históricamente vital para el imperio español por sus minas de mercurio, indispensables para la extracción de plata." },
  { nombre: "SAN GABRIEL", lat: -15.5000, lng: -72.0000, region: "Arequipa", ciudad: "Arequipa", datoCurioso: "Arequipa, la 'Ciudad Blanca', es el centro económico del sur del Perú, famosa por su centro histórico construido con sillar volcánico." },
  { nombre: "RAURA", lat: -10.5000, lng: -76.7000, region: "Oyón, Lima", ciudad: "Oyón", datoCurioso: "Oyón es una provincia andina de la región Lima, caracterizada por su producción minera y sus paisajes de altura." },
  { nombre: "CHORRILLOS", lat: -12.2000, lng: -77.0000, region: "Lima", ciudad: "Lima", datoCurioso: "Chorrillos es un distrito tradicional de Lima, famoso por su malecón y por ser escenario de la Batalla de San Juan en la Guerra del Pacífico." },
  { nombre: "GAMBETTA", lat: -12.0500, lng: -77.1000, region: "Callao", ciudad: "Callao", datoCurioso: "El Callao es el principal puerto del Perú, con una historia marítima de más de 400 años y el Aeropuerto Internacional Jorge Chávez." },
  { nombre: "INDUSTRIAL", lat: -12.0000, lng: -77.0000, region: "Lima", ciudad: "Lima", datoCurioso: "Lima, la 'Ciudad de los Reyes', es la capital del Perú y alberga una de las gastronomías más reconocidas del mundo." },
  { nombre: "CUSCO", lat: -13.5319, lng: -71.9675, region: "Cusco", ciudad: "Cusco", datoCurioso: "El Cusco fue la capital del Imperio Inca, es Patrimonio de la Humanidad y es la puerta de entrada a Machu Picchu." },
  { nombre: "AREQUIPA", lat: -16.3989, lng: -71.5350, region: "Arequipa", ciudad: "Arequipa", datoCurioso: "Arequipa, la 'Ciudad Blanca', es el centro económico del sur del Perú, famosa por su centro histórico construido con sillar volcánico." },
  { nombre: "HUARAZ", lat: -9.5278, lng: -77.5278, region: "Ancash", ciudad: "Huaraz", datoCurioso: "Huaraz es la puerta de entrada a la Cordillera Blanca, la cadena tropical más alta del mundo, ideal para andinismo." },
  { nombre: "HUANCAYO", lat: -12.0673, lng: -75.2100, region: "Junín", ciudad: "Huancayo", datoCurioso: "Huancayo es el corazón del Valle del Mantaro, famoso por su feria dominical y su tradicional gastronomía andina." },
  { nombre: "TRUJILLO", lat: -8.1116, lng: -79.0288, region: "La Libertad", ciudad: "Trujillo", datoCurioso: "Trujillo, la 'Ciudad de la Eterna Primavera', alberga las ruinas de Chan Chan, la ciudad de barro más grande de América." },
  { nombre: "ICA", lat: -14.0678, lng: -75.7286, region: "Ica", ciudad: "Ica", datoCurioso: "Ica es el principal productor de pisco y vinos del Perú, además de hogar de las oasis de Huacachina." },
  { nombre: "LIMA", lat: -12.0464, lng: -77.0428, region: "Lima", ciudad: "Lima", datoCurioso: "Lima, la 'Ciudad de los Reyes', es la capital del Perú y alberga una de las gastronomías más reconocidas del mundo." },
  { nombre: "CHILE", lat: -33.4489, lng: -70.6693, region: "Santiago, Chile", ciudad: "Santiago", datoCurioso: "Santiago de Chile es una de las capitales más modernas de Sudamérica, rodeada por la imponente Cordillera de los Andes." },
  { nombre: "LURIN", lat: -12.2500, lng: -76.8667, region: "Lima", ciudad: "Lima", datoCurioso: "Lurin es un distrito del sur de Lima, conocido por sus tradicionales panaderías y las ruinas de Pachacámac." },
  { nombre: "CARAVELI", lat: -15.7833, lng: -73.3667, region: "Arequipa", ciudad: "Caravelí", datoCurioso: "Caravelí es una provincia arequipeña conocida por sus vides de altura, produciendo vinos y piscos de gran calidad." },
];

// Función para buscar coordenada por sede
export function findMinaCoord(sede: string): MinaCoord | null {
  if (!sede) return null;
  const sedeUpper = sede.toUpperCase().trim();
  
  let found = MINAS_PERU.find(m => m.nombre === sedeUpper);
  if (found) return found;
  
  found = MINAS_PERU.find(m => sedeUpper.includes(m.nombre));
  if (found) return found;
  
  found = MINAS_PERU.find(m => m.nombre.includes(sedeUpper));
  if (found) return found;
  
  return null;
}
