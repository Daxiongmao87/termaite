import React, { ReactNode } from 'react';
import { Box, Text, BoxProps, TextProps } from 'ink';
import { useTheme } from '../ThemeProvider.js';
import { StyleProps, buildStyle, Theme } from '../theme.js';

// Styled Box Component
interface StyledBoxProps extends Omit<BoxProps, 'borderColor'> {
  component?: keyof Theme['components'];
  color?: keyof Theme['colors'];
  borderColor?: keyof Theme['borders']['colors'];
  spacing?: keyof Theme['spacing'];
  children?: ReactNode;
}

export const StyledBox: React.FC<StyledBoxProps> = ({ 
  component, 
  color, 
  borderColor, 
  spacing,
  children, 
  ...boxProps 
}) => {
  const { theme } = useTheme();
  
  let componentStyle: any = {};
  if (component && component !== 'agent') {
    const compStyle = theme.components[component];
    if ('borderColor' in compStyle) {
      componentStyle = {
        borderColor: compStyle.borderColor,
        ...compStyle.backgroundColor && { backgroundColor: compStyle.backgroundColor },
      };
    }
  }
  
  const customStyle = buildStyle(theme, { color, borderColor, spacing });
  
  return (
    <Box 
      {...boxProps} 
      {...componentStyle}
      {...customStyle}
    >
      {children}
    </Box>
  );
};

// Styled Text Component
interface StyledTextProps extends Omit<TextProps, 'bold' | 'color'> {
  agent?: keyof Theme['components']['agent'];
  color?: keyof Theme['colors'];
  bold?: boolean;
  dim?: boolean;
  children?: ReactNode;
}

export const StyledText: React.FC<StyledTextProps> = ({ 
  agent,
  color, 
  bold, 
  dim,
  children, 
  ...textProps 
}) => {
  const { theme } = useTheme();
  
  let agentColor;
  if (agent) {
    agentColor = theme.components.agent[agent];
  }
  
  const style = buildStyle(theme, { color, bold, dim });
  
  return (
    <Text 
      {...textProps}
      color={agentColor || style.color}
      bold={style.bold}
      dimColor={style.dimColor}
    >
      {children}
    </Text>
  );
};

// Layout Components
interface HeaderBoxProps extends Omit<BoxProps, 'borderColor' | 'borderStyle'> {
  children: ReactNode;
}

export const HeaderBox: React.FC<HeaderBoxProps> = ({ children, ...props }) => {
  return (
    <StyledBox 
      component="header" 
      borderStyle="single" 
      paddingX={1}
      {...props}
    >
      {children}
    </StyledBox>
  );
};

interface StatusBoxProps extends Omit<BoxProps, 'borderColor' | 'borderStyle'> {
  children: ReactNode;
}

export const StatusBox: React.FC<StatusBoxProps> = ({ children, ...props }) => {
  return (
    <StyledBox 
      component="status" 
      borderStyle="single" 
      paddingX={1}
      marginY={1}
      {...props}
    >
      {children}
    </StyledBox>
  );
};

interface ContentBoxProps extends Omit<BoxProps, 'borderColor' | 'borderStyle'> {
  children: ReactNode;
}

export const ContentBox: React.FC<ContentBoxProps> = ({ children, ...props }) => {
  return (
    <StyledBox 
      component="content" 
      borderStyle="single" 
      paddingX={1}
      {...props}
    >
      {children}
    </StyledBox>
  );
};

interface FooterBoxProps extends Omit<BoxProps, 'borderColor' | 'borderStyle'> {
  children: ReactNode;
}

export const FooterBox: React.FC<FooterBoxProps> = ({ children, ...props }) => {
  return (
    <StyledBox 
      component="footer" 
      borderStyle="single" 
      paddingX={1}
      {...props}
    >
      {children}
    </StyledBox>
  );
};
