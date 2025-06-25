export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    dim: string;
    border: string;
    background: string;
    text: string;
  };
  spacing: {
    small: number;
    medium: number;
    large: number;
  };
}

export const theme: Theme = {
  colors: {
    primary: '#00D2FF',
    secondary: '#3F8FFF', 
    accent: '#FFB900',
    success: '#13CE66',
    warning: '#FF9500',
    error: '#FF4757',
    info: '#5DADE2',
    dim: '#6C7B7F',
    border: '#34495E',
    background: '#1E1E1E',
    text: '#FFFFFF',
  },
  spacing: {
    small: 1,
    medium: 2,
    large: 3,
  },
};
