/** Städte mit Zentrumskoordinaten (Standort = Stadt + Radius, nie exakte Adresse). */
export type City = { name: string; country: string; region: string; lat: number; lng: number };

export const CITIES: City[] = [
  { name: "Zürich", country: "CH", region: "ZH", lat: 47.3769, lng: 8.5417 },
  { name: "Winterthur", country: "CH", region: "ZH", lat: 47.4988, lng: 8.7237 },
  { name: "Uster", country: "CH", region: "ZH", lat: 47.3471, lng: 8.7209 },
  { name: "Dietikon", country: "CH", region: "ZH", lat: 47.4017, lng: 8.4001 },
  { name: "Wetzikon", country: "CH", region: "ZH", lat: 47.3264, lng: 8.7978 },
  { name: "Bülach", country: "CH", region: "ZH", lat: 47.5217, lng: 8.5405 },
  { name: "Genf", country: "CH", region: "GE", lat: 46.2044, lng: 6.1432 },
  { name: "Basel", country: "CH", region: "BS", lat: 47.5596, lng: 7.5886 },
  { name: "Liestal", country: "CH", region: "BL", lat: 47.4846, lng: 7.7346 },
  { name: "Lausanne", country: "CH", region: "VD", lat: 46.5197, lng: 6.6323 },
  { name: "Montreux", country: "CH", region: "VD", lat: 46.4312, lng: 6.9107 },
  { name: "Yverdon-les-Bains", country: "CH", region: "VD", lat: 46.7785, lng: 6.6411 },
  { name: "Bern", country: "CH", region: "BE", lat: 46.948, lng: 7.4474 },
  { name: "Biel/Bienne", country: "CH", region: "BE", lat: 47.1368, lng: 7.2468 },
  { name: "Thun", country: "CH", region: "BE", lat: 46.758, lng: 7.628 },
  { name: "Luzern", country: "CH", region: "LU", lat: 47.0502, lng: 8.3093 },
  { name: "St. Gallen", country: "CH", region: "SG", lat: 47.4245, lng: 9.3767 },
  { name: "Rapperswil-Jona", country: "CH", region: "SG", lat: 47.2266, lng: 8.8184 },
  { name: "Wil", country: "CH", region: "SG", lat: 47.4615, lng: 9.0455 },
  { name: "Lugano", country: "CH", region: "TI", lat: 46.0037, lng: 8.9511 },
  { name: "Bellinzona", country: "CH", region: "TI", lat: 46.1946, lng: 9.0175 },
  { name: "Locarno", country: "CH", region: "TI", lat: 46.1709, lng: 8.7995 },
  { name: "Chiasso", country: "CH", region: "TI", lat: 45.8356, lng: 9.0291 },
  { name: "Aarau", country: "CH", region: "AG", lat: 47.3925, lng: 8.0442 },
  { name: "Baden", country: "CH", region: "AG", lat: 47.4733, lng: 8.3059 },
  { name: "Wettingen", country: "CH", region: "AG", lat: 47.4705, lng: 8.3164 },
  { name: "Brugg", country: "CH", region: "AG", lat: 47.4808, lng: 8.2087 },
  { name: "Zofingen", country: "CH", region: "AG", lat: 47.2877, lng: 7.9459 },
  { name: "Olten", country: "CH", region: "SO", lat: 47.3499, lng: 7.9077 },
  { name: "Solothurn", country: "CH", region: "SO", lat: 47.2088, lng: 7.5323 },
  { name: "Grenchen", country: "CH", region: "SO", lat: 47.1923, lng: 7.3955 },
  { name: "Freiburg", country: "CH", region: "FR", lat: 46.8065, lng: 7.1619 },
  { name: "Bulle", country: "CH", region: "FR", lat: 46.6193, lng: 7.0577 },
  { name: "Neuenburg", country: "CH", region: "NE", lat: 46.9899, lng: 6.9293 },
  { name: "La Chaux-de-Fonds", country: "CH", region: "NE", lat: 47.1035, lng: 6.8328 },
  { name: "Sitten", country: "CH", region: "VS", lat: 46.2331, lng: 7.3606 },
  { name: "Martigny", country: "CH", region: "VS", lat: 46.1028, lng: 7.0727 },
  { name: "Visp", country: "CH", region: "VS", lat: 46.2939, lng: 7.8815 },
  { name: "Chur", country: "CH", region: "GR", lat: 46.8508, lng: 9.532 },
  { name: "Davos", country: "CH", region: "GR", lat: 46.8027, lng: 9.836 },
  { name: "Frauenfeld", country: "CH", region: "TG", lat: 47.5536, lng: 8.8987 },
  { name: "Kreuzlingen", country: "CH", region: "TG", lat: 47.6505, lng: 9.1754 },
  { name: "Schaffhausen", country: "CH", region: "SH", lat: 47.6973, lng: 8.6349 },
  { name: "Zug", country: "CH", region: "ZG", lat: 47.1662, lng: 8.5155 },
  { name: "Schwyz", country: "CH", region: "SZ", lat: 47.0207, lng: 8.6541 },
  { name: "Pfäffikon SZ", country: "CH", region: "SZ", lat: 47.2023, lng: 8.7783 },
  { name: "Glarus", country: "CH", region: "GL", lat: 47.0404, lng: 9.068 },
  { name: "Herisau", country: "CH", region: "AR", lat: 47.3862, lng: 9.2792 },
  { name: "Appenzell", country: "CH", region: "AI", lat: 47.3307, lng: 9.4093 },
  { name: "Altdorf", country: "CH", region: "UR", lat: 46.8804, lng: 8.6444 },
  { name: "Sarnen", country: "CH", region: "OW", lat: 46.8961, lng: 8.2466 },
  { name: "Stans", country: "CH", region: "NW", lat: 46.9581, lng: 8.3661 },
  { name: "Delémont", country: "CH", region: "JU", lat: 47.365, lng: 7.3445 },
  { name: "Vaduz", country: "LI", region: "LI", lat: 47.141, lng: 9.5215 },
  { name: "Konstanz", country: "DE", region: "BW", lat: 47.6779, lng: 9.1732 },
  { name: "Freiburg im Breisgau", country: "DE", region: "BW", lat: 47.999, lng: 7.8421 },
  { name: "Stuttgart", country: "DE", region: "BW", lat: 48.7758, lng: 9.1829 },
  { name: "München", country: "DE", region: "BY", lat: 48.1351, lng: 11.582 },
  { name: "Frankfurt am Main", country: "DE", region: "HE", lat: 50.1109, lng: 8.6821 },
  { name: "Berlin", country: "DE", region: "BE", lat: 52.52, lng: 13.405 },
  { name: "Hamburg", country: "DE", region: "HH", lat: 53.5511, lng: 9.9937 },
  { name: "Köln", country: "DE", region: "NW", lat: 50.9375, lng: 6.9603 },
  { name: "Wien", country: "AT", region: "W", lat: 48.2082, lng: 16.3738 },
  { name: "Bregenz", country: "AT", region: "V", lat: 47.5031, lng: 9.7471 },
  { name: "Innsbruck", country: "AT", region: "T", lat: 47.2692, lng: 11.4041 },
  { name: "Salzburg", country: "AT", region: "S", lat: 47.8095, lng: 13.055 },
  { name: "Mailand", country: "IT", region: "LOM", lat: 45.4642, lng: 9.19 },
  { name: "Como", country: "IT", region: "LOM", lat: 45.8081, lng: 9.0852 },
  { name: "Paris", country: "FR", region: "IDF", lat: 48.8566, lng: 2.3522 },
  { name: "Lyon", country: "FR", region: "ARA", lat: 45.764, lng: 4.8357 },
  { name: "Annecy", country: "FR", region: "ARA", lat: 45.8992, lng: 6.1294 },
  { name: "Mülhausen", country: "FR", region: "GES", lat: 47.7508, lng: 7.3359 },
];

export function findCity(name: string) {
  return CITIES.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null;
}

/** Entfernung in km (Haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Auf ~1 km gerundete Position für die Kartenansicht. */
export function roundedPosition(lat: number, lng: number) {
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}
