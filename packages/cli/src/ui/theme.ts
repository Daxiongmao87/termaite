export interface Theme {
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
  };
  borders: {
    style: 'single' | 'double' | 'round' | 'bold';
    colors: {
      default: string;
      active: string;
      inactive: string;
    };
  };
  spacing: {
    small: number;
    medium: number;
    large: number;
  };
}

export const defaultTheme: Theme = {
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
  },
  borders: {
    style: 'single',
    colors: {
      default: 'gray',
      active: 'blue',
      inactive: 'dim',
    },
  },
  spacing: {
    small: 1,
    medium: 2,
    large: 3,
  },
};

export const getThemeColor = (colorName: keyof Theme['colors']): string => {
  return defaultTheme.colors[colorName];
};

export const getBorderStyle = (): 'single' | 'double' | 'round' | 'bold' => {
  return defaultTheme.borders.style;
};
