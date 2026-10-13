import { createContext, useContext, useEffect, useState } from 'react';

// Tema claro/escuro. Guardado em localStorage ('salesradar_theme') — as páginas Odoo embutidas
// (mesma origem) lêem a mesma chave. Escuro por defeito.
const ThemeContext = createContext({ theme: 'dark', toggle: () => {} });
const KEY = 'salesradar_theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem(KEY) || 'dark'; } catch { return 'dark'; } });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch { /* ignora */ }
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }));
  }, [theme]);
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);

// Lê uma variável CSS do tema (para o Chart.js, que precisa de cores concretas)
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
