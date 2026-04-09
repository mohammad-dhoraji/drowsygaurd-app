import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';

interface ThemeContextType {
  colorScheme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useDeviceColorScheme() ?? 'light';
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(systemColorScheme);

  useEffect(() => {
    setColorScheme(systemColorScheme);
  }, [systemColorScheme]);

  const toggleTheme = () => {
    setColorScheme((previousColorScheme) =>
      previousColorScheme === 'light' ? 'dark' : 'light'
    );
  };

  return (
    <ThemeContext.Provider value={{ colorScheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
