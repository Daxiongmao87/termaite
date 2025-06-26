import { createContext } from 'react';

export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    muted: string;
    text: string;
    background: string;
    accent: string;
    highlight: string;
    border: string;
  };
  borders: {
    style: 'single' | 'double' | 'round' | 'bold';
    colors: {
      default: string;
      active: string;
      inactive: string;
      focus: string;
    };
  };
  spacing: {
    none: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  typography: {
    sizes: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
  };
  components: {
    header: {
      borderColor: string;
      backgroundColor?: string;
      textColor: string;
    };
    status: {
      borderColor: string;
      backgroundColor?: string;
      textColor: string;
    };
    content: {
      borderColor: string;
      backgroundColor?: string;
      textColor: string;
    };
    footer: {
      borderColor: string;
      backgroundColor?: string;
      textColor: string;
    };
    agent: {
      plan: string;
      action: string;
      evaluation: string;
    };
  };
}

export const defaultTheme: Theme = {
  name: 'default',
  colors: {
    primary: 'blue',
    secondary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'black',
    accent: 'magenta',
    highlight: 'yellowBright',
    border: 'gray',
  },
  borders: {
    style: 'single',
    colors: {
      default: 'gray',
      active: 'blue',
      inactive: 'dim',
      focus: 'cyan',
    },
  },
  spacing: {
    none: 0,
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
  },
  typography: {
    sizes: {
      xs: 8,
      sm: 10,
      md: 12,
      lg: 14,
      xl: 16,
    },
  },
  components: {
    header: {
      borderColor: 'blue',
      textColor: 'blue',
    },
    status: {
      borderColor: 'green',
      textColor: 'green',
    },
    content: {
      borderColor: 'cyan',
      textColor: 'white',
    },
    footer: {
      borderColor: 'gray',
      textColor: 'gray',
    },
    agent: {
      plan: 'blue',
      action: 'yellow',
      evaluation: 'green',
    },
  },
};

export const compactTheme: Theme = {
  ...defaultTheme,
  name: 'compact',
  spacing: {
    none: 0,
    xs: 0,
    sm: 1,
    md: 1,
    lg: 2,
    xl: 2,
  },
  borders: {
    ...defaultTheme.borders,
    style: 'round',
  },
};

export const minimalTheme: Theme = {
  ...defaultTheme,
  name: 'minimal',
  colors: {
    ...defaultTheme.colors,
    primary: 'white',
    secondary: 'gray',
    muted: 'dim',
  },
  borders: {
    ...defaultTheme.borders,
    style: 'single',
    colors: {
      default: 'dim',
      active: 'white',
      inactive: 'dim',
      focus: 'gray',
    },
  },
};

// Available themes
export const themes: Record<string, Theme> = {
  default: defaultTheme,
  compact: compactTheme,
  minimal: minimalTheme,
};

// Theme Context Interface
export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themeName: string;
  switchTheme: (themeName: string) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme Utility Functions
export const getThemeColor = (theme: Theme, colorName: keyof Theme['colors']): string => {
  return theme.colors[colorName];
};

export const getBorderStyle = (theme: Theme): 'single' | 'double' | 'round' | 'bold' => {
  return theme.borders.style;
};

export const getBorderColor = (theme: Theme, type: keyof Theme['borders']['colors']): string => {
  return theme.borders.colors[type];
};

export const getSpacing = (theme: Theme, size: keyof Theme['spacing']): number => {
  return theme.spacing[size];
};

export const getComponentStyle = (theme: Theme, component: keyof Theme['components']) => {
  return theme.components[component];
};

export const getAgentColor = (theme: Theme, agent: keyof Theme['components']['agent']): string => {
  return theme.components.agent[agent];
};

// Style Builder Utilities
export interface StyleProps {
  color?: keyof Theme['colors'];
  borderColor?: keyof Theme['borders']['colors'];
  spacing?: keyof Theme['spacing'];
  bold?: boolean;
  dim?: boolean;
}

export const buildStyle = (theme: Theme, props: StyleProps) => {
  const style: any = {};
  
  if (props.color) {
    style.color = getThemeColor(theme, props.color);
  }
  
  if (props.borderColor) {
    style.borderColor = getBorderColor(theme, props.borderColor);
  }
  
  if (props.spacing) {
    style.padding = getSpacing(theme, props.spacing);
  }
  
  if (props.bold) {
    style.bold = true;
  }
  
  if (props.dim) {
    style.dimColor = true;
  }
  
  return style;
};
