import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Cpu, Droplet, Flame, Gem, Layers, Square, Zap, type LucideIcon } from "lucide-react";

// --- Thèmes clairs : dérivés d'une seule teinte via applyTheme(hue, dark). ---
// Inchangés par cette migration (seuls les thèmes sombres passent en
// palette déclarative, voir plus bas).
export interface LightColorTheme {
  id: string;
  label: string;
  icon: string; // emoji — convention existante conservée pour les thèmes clairs
  hue: number;
  dark: false;
}

export const LIGHT_THEMES: LightColorTheme[] = [
  { id: "isb", label: "ISB", icon: "🟤", hue: 36, dark: false },
  { id: "blue", label: "Bleu", icon: "🔵", hue: 220, dark: false },
  { id: "green", label: "Vert", icon: "🟢", hue: 142, dark: false },
  { id: "purple", label: "Violet", icon: "🟣", hue: 270, dark: false },
  { id: "red", label: "Rouge", icon: "🔴", hue: 0, dark: false },
  { id: "teal", label: "Teal", icon: "🩵", hue: 180, dark: false },
  { id: "pink", label: "Rose", icon: "🩷", hue: 330, dark: false },
];

// --- Thèmes sombres : palette hex explicite, aucune dérivation par formule. ---
// primaryForeground est choisi/vérifié par théorie WCAG AA (contraste texte
// >= 4.5:1) pour CHAQUE primary — voir le rapport final pour le détail des
// ratios. Le blanc pur échoue le seuil AA sur les 6 primary saturés "500"
// (ratios mesurés entre 2.1 et 4.2, tous < 4.5), donc primaryForeground
// utilise systématiquement la couleur de fond (bg) du thème plutôt qu'un
// blanc/quasi-blanc qui ne passerait pas le contraste réel.
export interface DarkPalette {
  bg: string;
  surface: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  text: string;
  secondary: string;
  border?: string; // par defaut rgba(255,255,255,0.12) si absent
  gradient?: string; // glass-dark uniquement — appliqué sur <body>, pas sur --background
}

export interface DarkColorTheme {
  id: string;
  label: string;
  icon: LucideIcon;
  dark: true;
  palette: DarkPalette;
}

export const DARK_THEMES: DarkColorTheme[] = [
  {
    id: "neon-blue",
    label: "Neon Blue",
    icon: Zap,
    dark: true,
    palette: {
      bg: "#0B1220",
      surface: "#111827",
      primary: "#3B82F6",
      primaryForeground: "#0B1220",
      accent: "#06B6D4",
      text: "#F9FAFB",
      secondary: "#9CA3AF",
    },
  },
  {
    id: "cyber-purple",
    label: "Cyber Purple",
    icon: Cpu,
    dark: true,
    palette: {
      bg: "#0D0B1F",
      surface: "#1A1538",
      primary: "#8B5CF6",
      primaryForeground: "#0D0B1F",
      accent: "#EC4899",
      text: "#F5F3FF",
      secondary: "#A78BFA",
    },
  },
  {
    id: "minimal-graphite",
    label: "Minimal Graphite",
    icon: Square,
    dark: true,
    palette: {
      bg: "#121212",
      surface: "#1E1E1E",
      primary: "#FFFFFF",
      primaryForeground: "#121212",
      accent: "#9CA3AF",
      text: "#F3F4F6",
      secondary: "#6B7280",
    },
  },
  {
    id: "emerald-dark",
    label: "Emerald Dark",
    icon: Gem,
    dark: true,
    palette: {
      bg: "#07140F",
      surface: "#10231C",
      primary: "#10B981",
      primaryForeground: "#07140F",
      accent: "#34D399",
      text: "#ECFDF5",
      secondary: "#A7F3D0",
    },
  },
  {
    id: "amber-night",
    label: "Amber Night",
    icon: Flame,
    dark: true,
    palette: {
      bg: "#18120A",
      surface: "#2A2115",
      primary: "#F59E0B",
      primaryForeground: "#18120A",
      accent: "#FBBF24",
      text: "#FFFBEB",
      secondary: "#FCD34D",
    },
  },
  {
    id: "crimson-dark",
    label: "Crimson Dark",
    icon: Droplet,
    dark: true,
    palette: {
      bg: "#160A0A",
      surface: "#281414",
      primary: "#EF4444",
      primaryForeground: "#160A0A",
      accent: "#F87171",
      text: "#FEF2F2",
      secondary: "#FCA5A5",
    },
  },
  {
    id: "glass-dark",
    label: "Glass Dark",
    icon: Layers,
    dark: true,
    palette: {
      bg: "#0F172A",
      gradient: "linear-gradient(160deg, #0F172A 0%, #1E293B 100%)",
      surface: "rgba(255,255,255,0.08)",
      primary: "#60A5FA",
      primaryForeground: "#0F172A",
      accent: "#A78BFA",
      text: "#FFFFFF",
      secondary: "#94A3B8",
      border: "rgba(255,255,255,0.15)",
    },
  },
];

export type ColorTheme = LightColorTheme | DarkColorTheme;

export const THEMES: ColorTheme[] = [...LIGHT_THEMES, ...DARK_THEMES];

// Anciens thèmes sombres hue-based, supprimés par cette migration — un id
// stocké correspondant à l'un d'eux doit basculer proprement sur un thème
// sombre par défaut plutôt que d'échouer silencieusement ou de planter.
const OLD_DARK_THEME_IDS = ["slate", "midnight", "charcoal", "forest", "plum", "navy", "wine"];
const DEFAULT_DARK_THEME_ID = "neon-blue";

function resolveThemeId(id: string): ColorTheme {
  const found = THEMES.find((t) => t.id === id);
  if (found) return found;
  if (OLD_DARK_THEME_IDS.includes(id)) {
    return THEMES.find((t) => t.id === DEFAULT_DARK_THEME_ID)!;
  }
  return THEMES[0];
}

const STORAGE_KEY = "isb-color-theme";

export function getStoredThemeId(): string {
  return localStorage.getItem(STORAGE_KEY) || "";
}

/** Thèmes clairs uniquement : toutes les variables sont dérivées d'une
 * seule teinte (hue). Écrit des valeurs hsl(...) complètes (et non plus des
 * triplets nus) pour rester compatible avec les thèmes sombres déclaratifs
 * qui, eux, écrivent du hex/rgba dans les mêmes variables CSS. */
export function applyTheme(hue: number, dark: boolean, themeId?: string) {
  const root = document.documentElement;
  const bgLight = dark ? 8 : 97;
  const fgLight = dark ? 90 : 12;
  const satBg = dark ? 40 : 100;
  const satFg = dark ? 60 : 100;
  const satSec = dark ? 40 : 100;
  const satMut = dark ? 30 : 16;
  const satMutFg = dark ? 30 : 18;
  const satBorder = dark ? 30 : 100;
  const satAcc = dark ? 30 : 16;

  root.style.setProperty("--background", `hsl(${hue} ${satBg}% ${bgLight}%)`);
  root.style.setProperty("--foreground", `hsl(${hue} ${satFg}% ${fgLight}%)`);
  root.style.setProperty("--primary", dark ? `hsl(${hue} 60% 70%)` : `hsl(${hue} 100% 12%)`);
  root.style.setProperty("--primary-foreground", dark ? `hsl(${hue} 80% 20%)` : `hsl(46 100% 50%)`);
  root.style.setProperty("--card", dark ? `hsl(0 0% 12%)` : `hsl(0 0% 100%)`);
  root.style.setProperty("--card-foreground", `hsl(${hue} ${satFg}% ${fgLight}%)`);
  root.style.setProperty("--secondary", `hsl(${hue} ${satSec}% ${dark ? 16 : 93}%)`);
  root.style.setProperty("--border", `hsl(${hue} ${satBorder}% ${dark ? 24 : 88}%)`);
  root.style.setProperty("--muted", `hsl(${hue} ${satMut}% ${dark ? 20 : 88}%)`);
  root.style.setProperty("--muted-foreground", `hsl(${hue} ${satMutFg}% ${dark ? 60 : 48}%)`);
  root.style.setProperty("--accent", `hsl(${hue} ${satAcc}% ${dark ? 20 : 88}%)`);
  root.style.setProperty("--ring", dark ? `hsl(${hue} 60% 70%)` : `hsl(${hue} 100% 12%)`);
  root.style.setProperty("--destructive", `hsl(0 80% 50%)`);
  root.style.setProperty("--destructive-foreground", `hsl(0 0% 100%)`);
  root.classList.toggle("dark", dark);
  root.setAttribute("data-theme", themeId ?? "");

  // Shorthand "background" (pas seulement backgroundColor) pour effacer
  // tout degrade laisse par un theme glass-dark precedemment actif.
  document.body.style.background = `hsl(${hue} ${satBg}% ${bgLight}%)`;
  document.body.style.color = `hsl(${hue} ${satFg}% ${fgLight}%)`;
}

/** Thèmes sombres uniquement : pose directement les valeurs de la palette
 * sur les variables CSS, sans aucun calcul. */
export function applyDeclarativeTheme(palette: DarkPalette, themeId: string) {
  const root = document.documentElement;
  const border = palette.border ?? "rgba(255,255,255,0.12)";

  root.style.setProperty("--background", palette.bg);
  root.style.setProperty("--foreground", palette.text);
  root.style.setProperty("--primary", palette.primary);
  root.style.setProperty("--primary-foreground", palette.primaryForeground);
  root.style.setProperty("--card", palette.surface);
  root.style.setProperty("--card-foreground", palette.text);
  root.style.setProperty("--secondary", palette.surface);
  root.style.setProperty("--border", border);
  root.style.setProperty("--muted", palette.surface);
  root.style.setProperty("--muted-foreground", palette.secondary);
  root.style.setProperty("--accent", palette.accent);
  root.style.setProperty("--ring", palette.primary);
  root.style.setProperty("--destructive", "#ef4444");
  root.style.setProperty("--destructive-foreground", "#ffffff");
  root.classList.add("dark");
  root.setAttribute("data-theme", themeId);

  // Shorthand "background" : reinitialise implicitement backgroundImage a
  // "none" pour les palettes sans degrade, donc pas de residu visuel en
  // provenance d'un theme glass-dark precedent.
  document.body.style.background = palette.gradient ?? palette.bg;
  document.body.style.color = palette.text;
}

function applyResolvedTheme(t: ColorTheme) {
  if (t.dark) {
    applyDeclarativeTheme(t.palette, t.id);
  } else {
    applyTheme(t.hue, false, t.id);
  }
}

interface ThemeContextType {
  theme: ColorTheme;
  themes: ColorTheme[];
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ColorThemeProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  // Ecrans sans session utilisateur fiable (login, callbacks OIDC) :
  // toujours le rendu clair par defaut (isb, hue=36), jamais le thème du
  // dernier utilisateur connecté sur ce poste. Inchangé par cette migration.
  const forcesNeutralTheme =
    location.pathname === "/login" ||
    location.pathname.startsWith("/auth/");

  const [theme, setThemeState] = useState<ColorTheme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? resolveThemeId(saved) : THEMES[0];
  });

  useEffect(() => {
    if (forcesNeutralTheme) {
      applyTheme(36, false, "isb");
    } else {
      applyResolvedTheme(theme);
    }
  }, [theme, forcesNeutralTheme]);

  const setTheme = (id: string) => {
    const resolved = resolveThemeId(id);
    applyResolvedTheme(resolved);
    setThemeState(resolved);
    // Persiste toujours l'id resolu (jamais un ancien id sombre supprime),
    // pour que la migration ne se re-declenche pas a chaque chargement.
    localStorage.setItem(STORAGE_KEY, resolved.id);
  };

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useColorTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useColorTheme must be used within ColorThemeProvider");
  return ctx;
}
