/**
 * Text Moderation Library
 *
 * Lightweight text moderation for board names and descriptions.
 * Implements a 3-phase detection system:
 * 1. Aggressive normalization (leetspeak, homoglyphs, separations)
 * 2. Blacklist absolute check
 * 3. Contextual detection with set combinations
 *
 * Target: Board descriptions (max 200 chars) and names
 * Languages: Spanish and English
 */

// NORMALIZATION HELPERS

const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic lookalikes
  а: "a",
  е: "e",
  і: "i",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  ѕ: "s",
  ј: "j",
  һ: "h",
  ԁ: "d",
  ԝ: "w",
  ɡ: "g",
  ʙ: "b",
  ɴ: "n",
  ᴍ: "m",
  ᴛ: "t",
  ᴋ: "k",
  ɪ: "i",
  // Greek lookalikes
  α: "a",
  ε: "e",
  ι: "i",
  ο: "o",
  ρ: "p",
  τ: "t",
  υ: "u",
  ν: "v",
};

const LEETSPEAK: Record<string, string> = {
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
  "+": "t",
};

// BLACKLIST - Always block, no context needed

const BLACKLIST_ABSOLUTE: string[] = [
  // Direct critical terms
  "cp",
  "pthc",
  "pedo",
  "pedofil",
  "pedofilo",
  "pedofilia",
  "pedophil",
  "pedophile",
  "pedophilia",
  "csam", // Child Sexual Abuse Material

  // International slang
  "loli",
  "lolita",
  "lolicon",
  "shota",
  "shotacon",
  "jailbait",
  "preteen",
  "preteens",

  // Known coded terms
  "cheesepizza",
  "cheese pizza",
  "pizzagate",
  "cub",
  "cubs",

  // MAP/NOMAP
  "map pride",
  "nomap",
  "pro map",
  "minor attracted",

  // Explicit Spanish
  "pornografia infantil",
  "porno infantil",
  "abuso infantil",
  "abuso de menores",
  "sexo con menores",
  "sexo con niños",
  "sexo con niñas",

  // Explicit English
  "child porn",
  "child abuse",
  "kiddie porn",
  "underage porn",
  "underage sex",
  "sex with minors",
  "sex with children",
  "sex with kids",

  // Community terms for targeting minors
  "fresh meat",
  "fresh ones",
  "freshie",
  "freshies",
  "prime meat",
  "young meat",

  // Abbreviations
  "mnr", // menor
  "mns", // menores
  "menor d edad",
  "menores d edad",

  // Compound phrases (unambiguously malicious)
  "busco menor",
  "busco menores",
  "buscando menor",
  "buscando menores",
  "fotos de niño",
  "fotos de niña",
  "fotos de niños",
  "fotos de niñas",
  "videos de niño",
  "videos de niña",
  "videos de niños",
  "videos de niñas",
  "pack de niño",
  "pack de niña",
  "pack de niños",
  "pack de niñas",
  "pack de menor",
  "pack de menores",
  "telegram menor",
  "telegram menores",
  "grupo de menor",
  "grupo de menores",
  "contenido de menor",
  "contenido de menores",
  "contenido de niño",
  "contenido de niña",
  "contenido de niños",
  "contenido de niñas",
  "intercambio menor",
  "intercambio menores",
  "intercambio niño",
  "intercambio niña",
  "intercambio niños",
  "intercambio niñas",
  "vendo menor",
  "vendo menores",
  "compro menor",
  "compro menores",

  // Leetspeak/evasion of porn
  "nopor",
  "pr0n",
  "p0rn",
  "p0rno",
];

// WORD SETS FOR CONTEXTUAL DETECTION

const MINORS_SET: string[] = [
  // Spanish - general
  "niño",
  "niños",
  "niña",
  "niñas",
  "niñx",
  "niñes",
  "menor",
  "menores",
  "infante",
  "infantes",
  "bebe",
  "beba",
  "bebes",
  "bebé",
  "bebés",
  "adolescente",
  "adolescentes",
  "joven",
  "jovenes",
  "jóvenes",
  "jovencito",
  "jovencita",
  "chico",
  "chica",
  "chicos",
  "chicas",
  "chiquito",
  "chiquita",
  "chiquitin",
  "chiquitina",
  "peque",
  "peques",
  "pequeño",
  "pequeña",
  "nene",
  "nena",
  "nenes",
  "nenas",
  "criatura",
  "criaturas",
  "crio",
  "cria",
  "crios",
  "chamaco",
  "chamaca",
  "chamacos",
  "escolar",
  "escolares",
  "alumno",
  "alumna",
  "alumnos",
  "alumnas",
  "estudiante",
  "estudiantes",
  "puberto",
  "puberta",

  // Spanish - regional
  "morro",
  "morra",
  "morros",
  "morras",
  "morrito",
  "morrita",
  "chavito",
  "chavita",
  "chavitos",
  "chavitas",
  "patojo",
  "patoja",
  "patojos",
  "cipote",
  "cipotes",
  "cipota",
  "guri",
  "gurí",
  "guris",
  "pibe",
  "piba",
  "pibes",
  "pibas",
  "pibito",
  "pibita",
  "chavo",
  "chava",
  "chavos",
  "chavas",

  // English
  "child",
  "children",
  "kid",
  "kids",
  "kiddo",
  "kiddos",
  "teen",
  "teens",
  "teenager",
  "teenagers",
  "boy",
  "boys",
  "girl",
  "girls",
  "young",
  "younger",
  "youngest",
  "minor",
  "minors",
  "underage",
  "toddler",
  "toddlers",
  "infant",
  "infants",
  "juvenile",
  "juveniles",
  "youth",
  "youths",
  "schoolgirl",
  "schoolboy",
  "schoolkid",
  "tween",
  "tweens",

  // Additional terms
  "little ones",
  "littles",
  "youngster",
  "youngsters",
  "kinder",
  "pequeñitos",
  "pequeñitas",
  "chiquillos",
  "chiquillas",
  "escuincle",
  "escuincles",
  "guambra",
  "guambras",
  "pelado",
  "pelada",
  "pelados",
  "peladas",
  "cabro",
  "cabra",
  "cabros",
  "cabras",
  "liceista",
  "liceistas",
  "colegial",
  "colegiales",
  "secundaria",
  "primaria",
];

// Concerning age numbers (8-17)
const CONCERNING_AGES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

const SEXUAL_SET: string[] = [
  // Spanish
  "sexo",
  "sexual",
  "sexuales",
  "sexualidad",
  "xxx",
  "nsfw",
  "+18",
  "18+",
  "porn",
  "porno",
  "pornografia",
  "pornográfico",
  "erotico",
  "erótico",
  "erotica",
  "erótica",
  "hot",
  "caliente",
  "calientes",
  "cachondo",
  "cachonda",
  "desnudo",
  "desnuda",
  "desnudos",
  "desnudas",
  "nude",
  "nudes",
  "nudismo",
  "intimo",
  "íntimo",
  "intima",
  "íntima",
  "sensual",
  "sensuales",
  "morbo",
  "morboso",
  "morbosa",
  "pervertido",
  "pervertida",
  "fetiche",
  "fetiches",
  "fetish",
  "kinky",
  "kink",
  "sucio",
  "sucia",
  "cochinadas",
  "obsceno",
  "obscena",
  "lujuria",
  "lujurioso",

  // English
  "sex",
  "sexy",
  "sexting",
  "erotic",
  "erotica",
  "nudity",
  "naked",
  "intimate",
  "intimacy",
  "horny",
  "aroused",
  "arousing",
  "dirty",
  "filthy",
  "naughty",
  "lewd",
  "lewds",
  "obscene",
  "explicit",
  "adult content",
  "adult only",
  "x rated",
  "xrated",

  // Additional explicit terms
  "hentai",
  "rule34",
  "rule 34",
  "r34",
  "onlyfans",
  "fansly",
  "manyvids",
  "camgirl",
  "camboy",
  "webcam sex",
  "cybersex",
  "cibersexo",
  "sexcam",
  "stripchat",
  "chaturbate",
  "livejasmin",
  "amateur porn",
  "casero xxx",
  "amateur xxx",
  "contenido adulto",
  "solo adultos",
  "mayores de 18",
  "only adults",
  "adults only",
  "18 only",
  "solo mayores",
  "+18 only",
  "cuerpos",
  "cuerpazos",
  "cogiendo",
  "follando",
  "fucking",
  "masturbacion",
  "masturbación",
  "masturbation",
  "orgasmo",
  "orgasm",
  "orgasms",
  "cumshot",
  "corrida",
  "creampie",
  "anal",
  "vaginal",
  "oral sex",
  "sexo oral",
  "blowjob",
  "mamada",
  "handjob",
  "pajero",
  "pajera",
  "putas",
  "puta",
  "puto",
  "whore",
  "whores",
  "slut",
  "sluts",
  "milf",
  "dilf",
  "gilf",
  "cougar",
  "daddy",
  "papi",
  "mami",
  "bdsm",
  "bondage",
  "dominatrix",
  "sumiso",
  "sumisa",
  "submissive",
  "dominant",

  // Additional explicit terms
  "pack hot",
  "contenido hot",
  "fotos hot",
  "videos hot",
  "packs calientes",
  "pack caliente",
  "verga",
  "polla",
  "pene",
  "tetas",
  "senos",
  "pezones",
  "nalgas",
  "culo",
  "vagina",
  "coño",
  "chupar",
  "follar",
  "culiar",
  "pajear",
  "pajeando",
  "tocamientos",
  "cock",
  "dick",
  "pussy",
  "ass",
  "boobs",
  "tits",
  "screw",
  "jerk off",
  "jerking",
];

const MEDIA_EXCHANGE_SET: string[] = [
  // Spanish
  "foto",
  "fotos",
  "fotito",
  "fotitos",
  "fotografia",
  "imagen",
  "imágenes",
  "imagenes",
  "img",
  "imgs",
  "video",
  "videos",
  "vídeo",
  "vídeos",
  "vid",
  "vids",
  "contenido",
  "contenidos",
  "cont",
  "material",
  "materiales",
  "archivo",
  "archivos",
  "pack",
  "packs",
  "packete",
  "coleccion",
  "colección",
  "galeria",
  "galería",
  "album",
  "álbum",
  "grabacion",
  "grabación",
  "clip",
  "clips",
  "selfie",
  "selfies",
  "pic",
  "pics",

  // English
  "photo",
  "photos",
  "photograph",
  "image",
  "images",
  "content",
  "contents",
  "file",
  "files",
  "collection",
  "collections",
  "gallery",
  "galleries",
  "recording",
  "recordings",
  "picture",
  "pictures",
  "media",
];

const INTENT_SET: string[] = [
  // Spanish - Commercial
  "vendo",
  "vende",
  "vender",
  "venta",
  "compro",
  "compra",
  "comprar",
  "pago",
  "paga",
  "pagar",
  "precio",
  "precios",
  "gratis",
  "gratuito",
  "free",

  // Spanish - Exchange
  "intercambio",
  "intercambiar",
  "cambio",
  "cambiar",
  "trade",
  "tradeo",
  "swap",
  "trueque",

  // Spanish - Search/Offer
  "busco",
  "busca",
  "buscar",
  "buscando",
  "quiero",
  "quiere",
  "queremos",
  "necesito",
  "necesita",
  "ofrezco",
  "ofrece",
  "ofreciendo",
  "tengo",
  "tiene",
  "tenemos",
  "consigo",
  "conseguir",
  "doy",
  "dar",
  "damos",
  "comparto",
  "compartir",

  // Spanish - Availability
  "disponible",
  "disponibles",
  "hay",
  "existe",
  "manda",
  "mando",
  "mandar",
  "mandame",
  "envia",
  "envio",
  "enviar",
  "enviame",
  "paso",
  "pasa",
  "pasar",
  "pasame",

  // English
  "sell",
  "selling",
  "sale",
  "buy",
  "buying",
  "pay",
  "paying",
  "price",
  "cost",
  "offer",
  "offering",

  "exchange",
  "exchanging",
  "trading",
  "swapping",

  "looking for",
  "seeking",
  "searching",
  "want",
  "wanting",
  "wanted",
  "need",
  "needing",
  "have",
  "having",
  "got",
  "share",
  "sharing",
  "send",
  "sending",
  "give",
  "giving",
  "get",
  "getting",

  "available",
  "dm me",
  "dm for",
  "hmu",
  "hit me up",
];

const CONTACT_SET: string[] = [
  // Platforms
  "telegram",
  "tg",
  "t.me",
  "whatsapp",
  "wa",
  "wpp",
  "whats",
  "wsp",
  "discord",
  "dc",
  "snapchat",
  "snap",
  "sc",
  "kik",
  "signal",
  "wickr",
  "instagram",
  "insta",
  "ig",
  "twitter",
  "tiktok",
  "tt",
  "facebook",
  "fb",
  "messenger",
  "skype",
  "wechat",
  "line",

  // Private messaging - Spanish
  "dm",
  "md",
  "mensaje directo",
  "privado",
  "pv",
  "priv",
  "inbox",
  "ib",
  "escribeme",
  "escríbeme",
  "contacto",
  "contactame",
  "numero",
  "número",
  "cel",
  "celular",
  "chat",
  "chatear",
  "hablame",
  "háblame",
  "agregame",
  "agrégame",
  "añademe",
  "añádeme",

  // Private messaging - English
  "pm",
  "direct message",
  "private",
  "privately",
  "message me",
  "msg me",
  "text me",
  "contact",
  "contact me",
  "number",
  "phone",
  "add me",
  "follow me",
  "slide into",
];

const IMPLICIT_SUSPICIOUS: string[] = [
  // Spanish
  "lo que buscas",
  "lo que todos buscan",
  "sabes de que",
  "sabes de qué",
  "ya sabes",
  "lo prohibido",
  "cosas prohibidas",
  "material especial",
  "contenido especial",
  "exclusivo",
  "secreto",
  "ilegal",
  "sin censura",
  "privado real",
  "grupo vip",
  "acceso especial",

  // English
  "what you want",
  "what everyone wants",
  "you know what",
  "if you know",
  "forbidden",
  "prohibited",
  "special material",
  "special content",
  "uncensored",
  "real private",
  "vip group",
  "vip access",
  "the good stuff",

  // Additional suspicious patterns
  "si sabes",
  "tu sabes",
  "you know",
  "iykyk", // if you know you know
  "ykwim", // you know what i mean
  "para los que saben",
  "for those who know",
  "grupo privado",
  "private group",
  "canal secreto",
  "secret channel",
  "lo mejor",
  "the best stuff",
  "real stuff",
  "cosas reales",
  "authentic content",
  "contenido autentico",
  "contenido real",
  "real content",
  "hard to find",
  "dificil de encontrar",
  "rare content",
  "contenido raro",
  "underground",
  "deep web",
  "dark web",
  "darknet",
  "onion",
  "tor only",
];

// Suspicious emoji patterns (will check in original text)
const SUSPICIOUS_EMOJIS: string[] = [
  "🍕", // pizza = CP
  "🧀", // cheese = CP
  "🍬", // candy - luring
  "🍭", // lollipop - luring
  "🍫", // chocolate - luring
  "🔞", // 18+ combined with minors
  "👶", // baby
  "👧", // girl
  "👦", // boy
  "🧒", // child
];

const ROLE_INVERSION_PATTERNS: string[] = [
  // Spanish
  "mi hija busca",
  "mi hijo busca",
  "mi sobrina",
  "mi sobrino",
  "mi prima menor",
  "mi primo menor",
  "mi hermana menor",
  "mi hermano menor",
  "tengo una amiga de",
  "tengo un amigo de",
  "conozco una chica",
  "conozco un chico",

  // English
  "my daughter wants",
  "my son wants",
  "my niece",
  "my nephew",
  "my younger cousin",
  "my little cousin",
  "my younger sister",
  "my younger brother",
  "my little sister",
  "my little brother",
  "i know a girl",
  "i know a boy",
];

const LEGITIMATE_CONTEXTS: string[] = [
  // Spanish - Education/Care
  "clases para",
  "clases de",
  "cursos para",
  "educacion",
  "educación",
  "educativo",
  "escuela",
  "colegio",
  "instituto",
  "profesor",
  "profesora",
  "maestro",
  "maestra",
  "tutor",
  "tutora",
  "tutoria",
  "niñera",
  "niñero",
  "cuidador",
  "guarderia",
  "guardería",
  "apoyo escolar",
  "padres",
  "madres",
  "familia",
  "pediatra",
  "pediatría",

  // Spanish - Commerce
  "ropa para",
  "ropa de",
  "juguetes para",
  "libros para",

  // English - Education/Care
  "classes for",
  "courses for",
  "lessons for",
  "education",
  "educational",
  "school",
  "college",
  "teacher",
  "tutor",
  "tutoring",
  "babysitter",
  "nanny",
  "caregiver",
  "daycare",
  "childcare",
  "homework help",
  "parents",
  "family",

  // English - Commerce
  "clothes for",
  "toys for",
  "books for",

  // Age-related legitimate contexts
  "talla",
  "size",
  "cumpleaños",
  "cumpleanos",
  "birthday",
  "fiesta de",
  "party for",
  "regalo para",
  "regalo de",
  "gift for",
  "curso de",
  "course for",
  "grado",
  "grade",
  "nivel",
  "level",
  "años de experiencia",
  "years of experience",
  "aniversario",
  "anniversary",
  "celebracion",
  "celebration",
  "campamento",
  "camp",
  "deporte",
  "sports",
  "futbol",
  "soccer",
  "basketball",
  "volleyball",
  "natacion",
  "swimming",
  "gimnasia",
  "gymnastics",
];

// NORMALIZATION FUNCTIONS

function normalizeHomoglyphs(text: string): string {
  return text
    .split("")
    .map((char) => HOMOGLYPHS[char] || char)
    .join("");
}

function normalizeLeetspeak(text: string): string {
  return text
    .split("")
    .map((char) => LEETSPEAK[char] || char)
    .join("");
}

function removeDecorations(text: string): string {
  let normalized = text.replace(/[_\-\*\+\.\|~^`´'"""''«»]/g, "");
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, "");
  normalized = normalized.replace(/\s+/g, " ");
  return normalized;
}

function collapseSeparatedLetters(text: string): string {
  // First pass: collapse single letters with spaces between them
  // "n i ñ o s" → "niños", "s e x o" → "sexo"
  let result = text;

  // Repeatedly collapse until no more changes (handles any length)
  let previous = "";
  while (previous !== result) {
    previous = result;
    // Match single letter followed by space and another single letter
    result = result.replace(/\b([a-záéíóúüñ])\s+([a-záéíóúüñ])\b/gi, "$1$2");
  }

  // Also handle letters separated by dots, dashes, or underscores
  // "n.i.ñ.o.s" → "niños", "s-e-x-o" → "sexo"
  result = result.replace(/\b([a-záéíóúüñ])[._\-]+([a-záéíóúüñ])\b/gi, "$1$2");
  previous = "";
  while (previous !== result) {
    previous = result;
    result = result.replace(
      /\b([a-záéíóúüñ])[._\-]+([a-záéíóúüñ])\b/gi,
      "$1$2",
    );
  }

  return result;
}

// Important patterns to preserve (legitimate double letters in target words)
// These will be temporarily replaced, then restored after normalization
// IMPORTANT: Placeholders use § character which is never in normal text and won't be modified
const PRESERVE_PATTERNS: Array<{
  pattern: RegExp;
  placeholder: string;
  restore: string;
}> = [
  // English words with 'ee' that we need to detect - ORDER MATTERS: longer patterns first!
  { pattern: /preteens/g, placeholder: "§1§", restore: "preteens" },
  { pattern: /preteen/g, placeholder: "§2§", restore: "preteen" },
  { pattern: /teenagers/g, placeholder: "§3§", restore: "teenagers" },
  { pattern: /teenager/g, placeholder: "§4§", restore: "teenager" },
  { pattern: /teens/g, placeholder: "§5§", restore: "teens" },
  { pattern: /teen/g, placeholder: "§6§", restore: "teen" },
  { pattern: /tweens/g, placeholder: "§7§", restore: "tweens" },
  { pattern: /tween/g, placeholder: "§8§", restore: "tween" },
  { pattern: /creepy/g, placeholder: "§9§", restore: "creepy" },
  { pattern: /creep/g, placeholder: "§10§", restore: "creep" },
  { pattern: /seeking/g, placeholder: "§11§", restore: "seeking" },
  { pattern: /sweet/g, placeholder: "§12§", restore: "sweet" },
  { pattern: /meeting/g, placeholder: "§13§", restore: "meeting" },
  { pattern: /meet/g, placeholder: "§14§", restore: "meet" },
  { pattern: /feet/g, placeholder: "§15§", restore: "feet" },
  { pattern: /been/g, placeholder: "§16§", restore: "been" },
  { pattern: /seen/g, placeholder: "§17§", restore: "seen" },
  { pattern: /needing/g, placeholder: "§18§", restore: "needing" },
  { pattern: /need/g, placeholder: "§19§", restore: "need" },
  // Words with 'oo'
  { pattern: /schoolgirls/g, placeholder: "§20§", restore: "schoolgirls" },
  { pattern: /schoolgirl/g, placeholder: "§21§", restore: "schoolgirl" },
  { pattern: /schoolboys/g, placeholder: "§22§", restore: "schoolboys" },
  { pattern: /schoolboy/g, placeholder: "§23§", restore: "schoolboy" },
  { pattern: /schoolkids/g, placeholder: "§24§", restore: "schoolkids" },
  { pattern: /schoolkid/g, placeholder: "§25§", restore: "schoolkid" },
  { pattern: /looking/g, placeholder: "§26§", restore: "looking" },
  { pattern: /boobs/g, placeholder: "§27§", restore: "boobs" },
  { pattern: /boob/g, placeholder: "§28§", restore: "boob" },
  { pattern: /poop/g, placeholder: "§29§", restore: "poop" },
  { pattern: /toddlers/g, placeholder: "§30§", restore: "toddlers" },
  { pattern: /toddler/g, placeholder: "§31§", restore: "toddler" },
];

// Normalize common typo patterns and letter repetition
function normalizeTypos(text: string): string {
  let normalized = text;

  // Step 0: Preserve important patterns
  for (const { pattern, placeholder } of PRESERVE_PATTERNS) {
    normalized = normalized.replace(pattern, placeholder);
  }

  // Step 1: Collapse any letter repeated 3+ times to 2 (handles "menoooores" -> "menoores")
  normalized = normalized.replace(/(.)\1{2,}/g, "$1$1");

  // Step 2: For specific problematic patterns, collapse doubles to single
  // Target: "menoores" -> "menores", "seexo" -> "sexo", "niñoos" -> "niños"
  // But preserve: "ll" (Spanish), "rr" (Spanish), "ss", "cc", "nn"
  normalized = normalized.replace(/([aiouyáíóú])\1/g, "$1"); // Double vowels -> single (except 'e' for words like 'seen')
  normalized = normalized.replace(/([^elrnsczaeiouáéíóú])\1/g, "$1"); // Double consonants (preserve more)

  // Step 3: Specific substitutions
  // cs -> x (secso -> sexo approximation)
  normalized = normalized.replace(/cs/g, "x");
  // ks -> x
  normalized = normalized.replace(/ks/g, "x");
  // cks -> x
  normalized = normalized.replace(/cks/g, "x");

  // Step 4: Restore preserved patterns
  for (const { placeholder, restore } of PRESERVE_PATTERNS) {
    normalized = normalized.replace(new RegExp(placeholder, "g"), restore);
  }

  return normalized;
}

function aggressiveNormalize(text: string): string {
  let normalized = text.toLowerCase();
  normalized = normalizeHomoglyphs(normalized);
  normalized = removeDecorations(normalized);
  normalized = normalizeLeetspeak(normalized);
  normalized = normalizeTypos(normalized);
  normalized = collapseSeparatedLetters(normalized);
  return normalized.trim();
}

// DETECTION FUNCTIONS

// Short terms that need word boundary checking to avoid false positives
// e.g., "sex" in "essex", "cp" in "escape", "hot" in "photo"
const SHORT_TERMS_NEED_BOUNDARY: Set<string> = new Set([
  "sex",
  "cp",
  "xxx",
  "hot",
  "dm",
  "tg",
  "wa",
  "dc",
  "fb",
  "ig",
  "tt",
  "pm",
  "pv",
  "md",
  "ib",
  "sc",
  "vid",
  "pic",
  "img",
  "cel",
  "kid",
  "kids",
  "boy",
  "boys",
  "girl",
  "girls",
  "teen",
  "teens",
  "nude",
  "nudes",
  "porn",
  "porno",
  "anal",
  "oral",
  "cum",
  "ass",
  "tit",
  "tits",
  "dick",
  "cock",
  "cub",
  "cubs",
  "sub",
  "dom",
  "kik",
  "snap",
  "chat",
  "want",
  "need",
]);

// Check if a word needs boundary matching (short or prone to false positives)
function needsBoundaryCheck(word: string): boolean {
  return word.length <= 4 || SHORT_TERMS_NEED_BOUNDARY.has(word.toLowerCase());
}

// Check for word with proper boundary handling
function hasWordInText(text: string, word: string): boolean {
  if (needsBoundaryCheck(word)) {
    // Use word boundary regex for short terms
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(text);
  }
  // For longer terms, simple includes is fine and faster
  return text.includes(word);
}

function hasAnyWord(
  text: string,
  wordSet: string[],
): { found: boolean; matches: string[] } {
  const matches: string[] = [];
  for (const word of wordSet) {
    if (hasWordInText(text, word)) {
      matches.push(word);
    }
  }
  return { found: matches.length > 0, matches };
}

function checkBlacklist(text: string): { hit: boolean; term?: string } {
  for (const term of BLACKLIST_ABSOLUTE) {
    if (text.includes(term)) {
      return { hit: true, term };
    }
  }
  return { hit: false };
}

function hasLegitimateContext(text: string): boolean {
  for (const context of LEGITIMATE_CONTEXTS) {
    if (text.includes(context)) {
      return true;
    }
  }
  return false;
}

function checkImplicitSuspicious(text: string): {
  found: boolean;
  matches: string[];
} {
  const matches: string[] = [];
  for (const pattern of IMPLICIT_SUSPICIOUS) {
    if (text.includes(pattern)) {
      matches.push(pattern);
    }
  }
  return { found: matches.length > 0, matches };
}

function checkRoleInversion(text: string): {
  found: boolean;
  matches: string[];
} {
  const matches: string[] = [];
  for (const pattern of ROLE_INVERSION_PATTERNS) {
    if (text.includes(pattern)) {
      matches.push(pattern);
    }
  }
  return { found: matches.length > 0, matches };
}

// Check for concerning age patterns (e.g., "14 años", "12 years old", "busco de 15")
function checkAgePatterns(text: string): {
  found: boolean;
  ages: number[];
  matches: string[];
} {
  const ages: number[] = [];
  const matches: string[] = [];

  // Pattern 1: Number + age indicator (14 años, 12 years old)
  const ageIndicatorPattern =
    /(\d{1,2})\s*(años?|añitos?|years?\s*old|yr\s*old|yrs?\s*old|y\.?o\.?)\b/gi;
  let match;
  while ((match = ageIndicatorPattern.exec(text)) !== null) {
    const age = parseInt(match[1], 10);
    if (CONCERNING_AGES.includes(age)) {
      ages.push(age);
      matches.push(match[0]);
    }
  }

  // Pattern 2: Age ranges (12-16, 13 a 17)
  const rangePattern = /(\d{1,2})\s*[-–—a]\s*(\d{1,2})/gi;
  while ((match = rangePattern.exec(text)) !== null) {
    const age1 = parseInt(match[1], 10);
    const age2 = parseInt(match[2], 10);
    if (CONCERNING_AGES.includes(age1) || CONCERNING_AGES.includes(age2)) {
      ages.push(age1, age2);
      matches.push(match[0]);
    }
  }

  // Pattern 3: "de X" where X is concerning age (busco de 14)
  const dePattern = /\bde\s+(\d{1,2})\b/gi;
  while ((match = dePattern.exec(text)) !== null) {
    const age = parseInt(match[1], 10);
    if (CONCERNING_AGES.includes(age)) {
      ages.push(age);
      matches.push(match[0]);
    }
  }

  // Pattern 4: "menor de X" or "menores de X" or "under X"
  const underPattern = /\b(menor|menores|under)\s*(de)?\s*(\d{1,2})\b/gi;
  while ((match = underPattern.exec(text)) !== null) {
    const age = parseInt(match[3], 10);
    if (age >= 8 && age <= 21) {
      // Wider range for "under X"
      ages.push(age);
      matches.push(match[0]);
    }
  }

  // Pattern 5: "sub X" or "+X" (sub18, +18 less commonly but sub15, etc.)
  const subPattern = /\b(sub|menos de|\+)\s*(\d{1,2})\b/gi;
  while ((match = subPattern.exec(text)) !== null) {
    const age = parseInt(match[2], 10);
    if (CONCERNING_AGES.includes(age)) {
      ages.push(age);
      matches.push(match[0]);
    }
  }

  return { found: ages.length > 0, ages: [...new Set(ages)], matches };
}

// Check for social handles and links (grooming red flag - trying to move conversation off-platform)
function checkSuspiciousHandlesAndLinks(text: string): {
  found: boolean;
  matches: string[];
  score: number;
} {
  const matches: string[] = [];
  let score = 0;

  // Telegram links: t.me/username or telegram.me/username
  const telegramPattern = /t\.me\/[a-zA-Z0-9_]+|telegram\.me\/[a-zA-Z0-9_]+/gi;
  const telegramMatches = text.match(telegramPattern);
  if (telegramMatches) {
    matches.push(...telegramMatches);
    score += 8; // High score - direct Telegram link is very suspicious
  }

  // @ handles (common pattern for sharing social accounts)
  const handlePattern = /@[a-zA-Z0-9_]{3,}/g;
  const handleMatches = text.match(handlePattern);
  if (handleMatches) {
    matches.push(...handleMatches);
    score += 5; // Medium-high score
  }

  // WhatsApp patterns: wa.me/number or +number patterns
  const whatsappPattern = /wa\.me\/[0-9]+|\+[0-9]{10,}/gi;
  const whatsappMatches = text.match(whatsappPattern);
  if (whatsappMatches) {
    matches.push(...whatsappMatches);
    score += 8; // High score - sharing phone number
  }

  // Discord invite links
  const discordPattern =
    /discord\.gg\/[a-zA-Z0-9]+|discord\.com\/invite\/[a-zA-Z0-9]+/gi;
  const discordMatches = text.match(discordPattern);
  if (discordMatches) {
    matches.push(...discordMatches);
    score += 6;
  }

  // Generic "add me" patterns with platform names
  const addMePatterns = [
    /añad[ei]me\s+en\s+\w+/gi,
    /agregame\s+en\s+\w+/gi,
    /add\s+me\s+on\s+\w+/gi,
    /contact[ao]?me\s+en\s+\w+/gi,
    /escribeme\s+al?\s+\w+/gi,
    /hablame\s+al?\s+\w+/gi,
    /msg\s+me\s+on\s+\w+/gi,
  ];

  for (const pattern of addMePatterns) {
    const addMeMatches = text.match(pattern);
    if (addMeMatches) {
      matches.push(...addMeMatches);
      score += 4;
    }
  }

  return { found: matches.length > 0, matches, score };
}

// Check for suspicious emojis in original (non-normalized) text
function checkSuspiciousEmojis(
  originalText: string,
  hasMinorsContext: boolean,
  hasSexualContext: boolean,
): { found: boolean; matches: string[]; score: number } {
  const matches: string[] = [];
  let score = 0;

  for (const emoji of SUSPICIOUS_EMOJIS) {
    if (originalText.includes(emoji)) {
      matches.push(emoji);

      // Pizza/cheese emojis are always suspicious
      if (emoji === "🍕" || emoji === "🧀") {
        score += 5;
      }
      // Child emojis combined with sexual context
      else if (
        (emoji === "👶" ||
          emoji === "👧" ||
          emoji === "👦" ||
          emoji === "🧒") &&
        hasSexualContext
      ) {
        score += 8;
      }
      // Candy emojis in suspicious contexts
      else if (
        (emoji === "🍬" || emoji === "🍭" || emoji === "🍫") &&
        (hasMinorsContext || hasSexualContext)
      ) {
        score += 3;
      }
      // 18+ emoji with minors context
      else if (emoji === "🔞" && hasMinorsContext) {
        score += 10;
      }
    }
  }

  return { found: matches.length > 0, matches, score };
}

// MAIN MODERATION FUNCTION

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
  message?: string;
  score?: number;
}

/**
 * Moderate a board description or name
 * @param text - The text to moderate
 * @returns ModerationResult with allowed status and reason
 */
export function moderateDescription(text: string): ModerationResult {
  // Handle empty text
  if (!text || text.trim().length === 0) {
    return { allowed: true };
  }

  const originalText = text; // Keep original for emoji detection

  // Phase 1: Normalize
  const normalized = aggressiveNormalize(text);

  // Phase 2: Blacklist check (immediate block)
  const blacklist = checkBlacklist(normalized);
  if (blacklist.hit) {
    return {
      allowed: false,
      reason: "BLACKLIST_HIT",
      message: "Your text contains prohibited content.",
      score: 100,
    };
  }

  // Phase 3: Contextual detection
  const hasMinors = hasAnyWord(normalized, MINORS_SET);
  const hasSexual = hasAnyWord(normalized, SEXUAL_SET);
  const hasMedia = hasAnyWord(normalized, MEDIA_EXCHANGE_SET);
  const hasIntent = hasAnyWord(normalized, INTENT_SET);
  const hasContact = hasAnyWord(normalized, CONTACT_SET);
  const isLegitimate = hasLegitimateContext(normalized);

  // Phase 3.1: Age pattern detection
  const agePatterns = checkAgePatterns(normalized);

  // Phase 3.2: Emoji detection (on original text)
  const emojiCheck = checkSuspiciousEmojis(
    originalText,
    hasMinors.found,
    hasSexual.found,
  );

  // === SEXUAL CONTENT ALONE = BLOCK (for public discovery feed) ===
  if (hasSexual.found) {
    return {
      allowed: false,
      reason: "SEXUAL_CONTENT",
      message: "Adult/sexual content is not allowed in public boards.",
      score: 10,
    };
  }

  // === AGE + ANY SUSPICIOUS CONTEXT = BLOCK ===
  if (agePatterns.found) {
    // Age + any intent/media/contact = immediate block
    if (hasIntent.found || hasMedia.found || hasContact.found) {
      return {
        allowed: false,
        reason: "AGE_SUSPICIOUS_COMBINATION",
        message: "Your text was flagged for inappropriate content.",
        score: 15,
      };
    }
  }

  // === CRITICAL COMBINATIONS - IMMEDIATE BLOCK ===

  // SEXUAL + MINORS = BLOCK (always, even with legitimate context)
  // Note: This is now redundant since SEXUAL alone blocks, but kept for clarity
  if (hasSexual.found && hasMinors.found) {
    return {
      allowed: false,
      reason: "SEXUAL_MINORS_COMBINATION",
      message: "Your text was flagged for inappropriate content.",
      score: 15,
    };
  }

  // INTENT + MINORS = BLOCK (unless legitimate)
  if (hasIntent.found && hasMinors.found && !isLegitimate) {
    return {
      allowed: false,
      reason: "INTENT_MINORS_COMBINATION",
      message: "Your text was flagged for inappropriate content.",
      score: 12,
    };
  }

  // MEDIA + MINORS = BLOCK (unless legitimate)
  if (hasMedia.found && hasMinors.found && !isLegitimate) {
    return {
      allowed: false,
      reason: "MEDIA_MINORS_COMBINATION",
      message: "Your text was flagged for inappropriate content.",
      score: 15,
    };
  }

  // CONTACT + MINORS = BLOCK (unless legitimate)
  if (hasContact.found && hasMinors.found && !isLegitimate) {
    return {
      allowed: false,
      reason: "CONTACT_MINORS_COMBINATION",
      message: "Your text was flagged for inappropriate content.",
      score: 12,
    };
  }

  // INTENT + SEXUAL = BLOCK (redundant now but kept)
  if (hasIntent.found && hasSexual.found) {
    return {
      allowed: false,
      reason: "INTENT_SEXUAL_COMBINATION",
      message: "Adult content is not allowed in public boards.",
      score: 10,
    };
  }

  // SEXUAL + CONTACT = BLOCK (redundant now but kept)
  if (hasSexual.found && hasContact.found) {
    return {
      allowed: false,
      reason: "SEXUAL_CONTACT_COMBINATION",
      message: "Adult content is not allowed in public boards.",
      score: 10,
    };
  }

  // INTENT + MEDIA + (SEXUAL || MINORS) = BLOCK
  if (
    hasIntent.found &&
    hasMedia.found &&
    (hasSexual.found || (hasMinors.found && !isLegitimate))
  ) {
    return {
      allowed: false,
      reason: "INTENT_MEDIA_COMBINATION",
      message: "Your text was flagged for inappropriate content.",
      score: 12,
    };
  }

  // === EMOJI-BASED BLOCKS ===
  if (emojiCheck.found && emojiCheck.score >= 5) {
    return {
      allowed: false,
      reason: "SUSPICIOUS_EMOJI_PATTERN",
      message: "Your text was flagged for suspicious content.",
      score: emojiCheck.score,
    };
  }

  // === SUSPICIOUS HANDLES/LINKS (Anti-grooming) ===
  const handlesCheck = checkSuspiciousHandlesAndLinks(originalText);
  if (handlesCheck.found && handlesCheck.score >= 6) {
    return {
      allowed: false,
      reason: "SUSPICIOUS_CONTACT_PATTERN",
      message:
        "External contact information is not allowed in board descriptions.",
      score: handlesCheck.score,
    };
  }

  // Combined: handles + minors context = immediate block
  if (handlesCheck.found && hasMinors.found) {
    return {
      allowed: false,
      reason: "CONTACT_MINORS_PATTERN",
      message: "Your text was flagged for inappropriate content.",
      score: 15,
    };
  }

  // === IMPLICIT SUSPICIOUS PATTERNS ===
  const implicit = checkImplicitSuspicious(normalized);
  if (implicit.found) {
    return {
      allowed: false,
      reason: "IMPLICIT_SUSPICIOUS",
      message: "Your text contains suspicious language.",
      score: 6,
    };
  }

  // === ROLE INVERSION (GROOMING VIA PROXY) ===
  const roleInversion = checkRoleInversion(normalized);
  if (roleInversion.found) {
    return {
      allowed: false,
      reason: "ROLE_INVERSION",
      message: "Your text was flagged for inappropriate content.",
      score: 8,
    };
  }

  // All checks passed
  return { allowed: true };
}

/**
 * Quick check if text should be blocked
 */
export function shouldBlockText(text: string): boolean {
  return !moderateDescription(text).allowed;
}
