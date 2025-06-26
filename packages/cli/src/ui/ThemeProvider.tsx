import React, { useContext, ReactNode } from 'react';
import { ThemeContext, ThemeContextType, themes, defaultTheme, Theme } from './theme.js';

// Theme Provider Component
interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  initialTheme = 'default' 
}) => {
  const [currentTheme, setCurrentTheme] = React.useState<Theme>(
    themes[initialTheme] || defaultTheme
  );
  const [themeName, setThemeName] = React.useState<string>(initialTheme);

  const setTheme = (theme: Theme) => {
    setCurrentTheme(theme);
    setThemeName(theme.name);
  };

  const switchTheme = (name: string) => {
    const theme = themes[name];
    if (theme) {
      setTheme(theme);
    }
  };

  const value: ThemeContextType = {
    theme: currentTheme,
    setTheme,
    themeName,
    switchTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme Hook
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
