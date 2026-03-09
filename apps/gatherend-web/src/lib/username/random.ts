/**
 * Lista de palabras para generar usernames aleatorios
 */
const adjectives = [
  "Swift",
  "Brave",
  "Clever",
  "Bright",
  "Noble",
  "Silent",
  "Mighty",
  "Happy",
  "Lucky",
  "Cosmic",
  "Digital",
  "Crystal",
  "Thunder",
  "Shadow",
  "Golden",
  "Silver",
  "Rapid",
  "Epic",
  "Mystic",
  "Stellar",
];

const nouns = [
  "Phoenix",
  "Dragon",
  "Tiger",
  "Eagle",
  "Wolf",
  "Falcon",
  "Panda",
  "Lion",
  "Bear",
  "Hawk",
  "Raven",
  "Fox",
  "Lynx",
  "Otter",
  "Penguin",
  "Dolphin",
  "Owl",
  "Koala",
  "Jaguar",
  "Leopard",
];

/**
 * Genera un username aleatorio combinando un adjetivo y un sustantivo
 * Ejemplo: "SwiftPhoenix", "BraveDragon", etc.
 */
export function generateRandomUsername(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective}${noun}`;
}
