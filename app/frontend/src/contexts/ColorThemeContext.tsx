import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

// --- Thèmes clairs : dérivés d'une seule teinte via applyTheme(hue). ---
export interface LightColorTheme {
  id: string;
  label: string;
  icon: string; // emoji
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

export type ColorTheme = LightColorTheme;

export const THEMES: ColorTheme[] = LIGHT_THEMES;

// Anciens thèmes sombres, supprimés — un id stocké correspondant à l'un
// d'eux doit basculer proprement sur le thème clair par défaut plutôt que
// d'échouer silencieusement ou de planter.
const OLD_DARK_THEME_IDS = [
  "slate", "midnight", "charcoal", "forest", "plum", "navy", "wine",
  "neon-blue", "cyber-purple", "minimal-graphite", "emerald-dark",
  "amber-night", "crimson-dark", "glass-dark",
];
const DEFAULT_THEME_ID = "isb";

function resolveThemeId(id: string): ColorTheme {
  const found = THEMES.find((t) => t.id === id);
  if (found) return found;
  if (OLD_DARK_THEME_IDS.includes(id)) {
    return THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
  }
  return THEMES[0];
}

const STORAGE_KEY = "isb-color-theme";

export function getStoredThemeId(): string {
  return localStorage.getItem(STORAGE_KEY) || "";
}

/** Toutes les variables sont dérivées d'une seule teinte (hue). */
export function applyTheme(hue: number, themeId?: string) {
  const root = document.documentElement;
  const bgLight = 97;
  const fgLight = 12;

  root.style.setProperty("--background", `hsl(${hue} 100% ${bgLight}%)`);
  root.style.setProperty("--foreground", `hsl(${hue} 100% ${fgLight}%)`);
  root.style.setProperty("--primary", `hsl(${hue} 100% 12%)`);
  root.style.setProperty("--primary-foreground", `hsl(46 100% 50%)`);
  root.style.setProperty("--card", `hsl(0 0% 100%)`);
  root.style.setProperty("--card-foreground", `hsl(${hue} 100% ${fgLight}%)`);
  root.style.setProperty("--secondary", `hsl(${hue} 100% 93%)`);
  root.style.setProperty("--border", `hsl(${hue} 100% 88%)`);
  root.style.setProperty("--muted", `hsl(${hue} 16% 88%)`);
  root.style.setProperty("--muted-foreground", `hsl(${hue} 18% 48%)`);
  root.style.setProperty("--accent", `hsl(${hue} 16% 88%)`);
  root.style.setProperty("--ring", `hsl(${hue} 100% 12%)`);
  root.style.setProperty("--destructive", `hsl(0 80% 50%)`);
  root.style.setProperty("--destructive-foreground", `hsl(0 0% 100%)`);
  root.classList.remove("dark");
  root.setAttribute("data-theme", themeId ?? "");

  document.body.style.background = `hsl(${hue} 100% ${bgLight}%)`;
  document.body.style.color = `hsl(${hue} 100% ${fgLight}%)`;
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
  // dernier utilisateur connecté sur ce poste.
  const forcesNeutralTheme =
    location.pathname === "/login" ||
    location.pathname.startsWith("/auth/");

  const [theme, setThemeState] = useState<ColorTheme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? resolveThemeId(saved) : THEMES[0];
  });

  useEffect(() => {
    if (forcesNeutralTheme) {
      applyTheme(36, "isb");
    } else {
      applyTheme(theme.hue, theme.id);
    }
  }, [theme, forcesNeutralTheme]);

  const setTheme = (id: string) => {
    const resolved = resolveThemeId(id);
    applyTheme(resolved.hue, resolved.id);
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
