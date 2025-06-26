import { describe, it, expect } from 'vitest';
import { 
  defaultTheme, 
  compactTheme, 
  minimalTheme, 
  themes,
  getThemeColor, 
  getBorderStyle,
  getBorderColor,
  getSpacing,
  getComponentStyle,
  getAgentColor,
  buildStyle
} from '../theme.js';

describe('Theme Configuration', () => {
  it('should have all required color properties', () => {
    const requiredColors = [
      'primary', 'secondary', 'success', 'warning', 
      'error', 'info', 'muted', 'text', 'background',
      'accent', 'highlight', 'border'
    ];

    requiredColors.forEach(color => {
      expect(defaultTheme.colors).toHaveProperty(color);
      expect(typeof defaultTheme.colors[color as keyof typeof defaultTheme.colors]).toBe('string');
    });
  });

  it('should have border configuration', () => {
    expect(defaultTheme.borders).toBeDefined();
    expect(defaultTheme.borders.style).toBeDefined();
    expect(defaultTheme.borders.colors).toBeDefined();
    expect(defaultTheme.borders.colors.default).toBeDefined();
    expect(defaultTheme.borders.colors.active).toBeDefined();
    expect(defaultTheme.borders.colors.inactive).toBeDefined();
    expect(defaultTheme.borders.colors.focus).toBeDefined();
  });

  it('should have spacing configuration', () => {
    expect(defaultTheme.spacing).toBeDefined();
    expect(typeof defaultTheme.spacing.none).toBe('number');
    expect(typeof defaultTheme.spacing.xs).toBe('number');
    expect(typeof defaultTheme.spacing.sm).toBe('number');
    expect(typeof defaultTheme.spacing.md).toBe('number');
    expect(typeof defaultTheme.spacing.lg).toBe('number');
    expect(typeof defaultTheme.spacing.xl).toBe('number');
  });

  it('should have typography configuration', () => {
    expect(defaultTheme.typography).toBeDefined();
    expect(defaultTheme.typography.sizes).toBeDefined();
    expect(typeof defaultTheme.typography.sizes.xs).toBe('number');
    expect(typeof defaultTheme.typography.sizes.sm).toBe('number');
    expect(typeof defaultTheme.typography.sizes.md).toBe('number');
    expect(typeof defaultTheme.typography.sizes.lg).toBe('number');
    expect(typeof defaultTheme.typography.sizes.xl).toBe('number');
  });

  it('should have component styles', () => {
    expect(defaultTheme.components).toBeDefined();
    expect(defaultTheme.components.header).toBeDefined();
    expect(defaultTheme.components.status).toBeDefined();
    expect(defaultTheme.components.content).toBeDefined();
    expect(defaultTheme.components.footer).toBeDefined();
    expect(defaultTheme.components.agent).toBeDefined();
  });

  it('should return correct colors from getThemeColor', () => {
    expect(getThemeColor(defaultTheme, 'primary')).toBe('blue');
    expect(getThemeColor(defaultTheme, 'success')).toBe('green');
    expect(getThemeColor(defaultTheme, 'error')).toBe('red');
    expect(getThemeColor(defaultTheme, 'warning')).toBe('yellow');
  });

  it('should return correct border style', () => {
    expect(getBorderStyle(defaultTheme)).toBe('single');
    expect(getBorderStyle(compactTheme)).toBe('round');
  });

  it('should return correct border colors', () => {
    expect(getBorderColor(defaultTheme, 'default')).toBe('gray');
    expect(getBorderColor(defaultTheme, 'active')).toBe('blue');
    expect(getBorderColor(defaultTheme, 'focus')).toBe('cyan');
  });

  it('should return correct spacing values', () => {
    expect(getSpacing(defaultTheme, 'none')).toBe(0);
    expect(getSpacing(defaultTheme, 'xs')).toBe(1);
    expect(getSpacing(defaultTheme, 'md')).toBe(3);
    expect(getSpacing(compactTheme, 'md')).toBe(1);
  });

  it('should return component styles', () => {
    const headerStyle = getComponentStyle(defaultTheme, 'header');
    expect(headerStyle).toHaveProperty('borderColor');
    expect(headerStyle).toHaveProperty('textColor');
    if ('borderColor' in headerStyle) {
      expect(headerStyle.borderColor).toBe('blue');
      expect(headerStyle.textColor).toBe('blue');
    }
  });

  it('should return agent colors', () => {
    expect(getAgentColor(defaultTheme, 'plan')).toBe('blue');
    expect(getAgentColor(defaultTheme, 'action')).toBe('yellow');
    expect(getAgentColor(defaultTheme, 'evaluation')).toBe('green');
  });

  it('should build styles correctly', () => {
    const style = buildStyle(defaultTheme, {
      color: 'primary',
      borderColor: 'active',
      spacing: 'md',
      bold: true,
      dim: false
    });

    expect(style.color).toBe('blue');
    expect(style.borderColor).toBe('blue');
    expect(style.padding).toBe(3);
    expect(style.bold).toBe(true);
    expect(style.dimColor).toBe(undefined);
  });

  it('should have all themes available', () => {
    expect(themes.default).toBeDefined();
    expect(themes.compact).toBeDefined();
    expect(themes.minimal).toBeDefined();
    expect(themes.default.name).toBe('default');
    expect(themes.compact.name).toBe('compact');
    expect(themes.minimal.name).toBe('minimal');
  });

  it('should have different configurations for different themes', () => {
    expect(defaultTheme.spacing.md).toBe(3);
    expect(compactTheme.spacing.md).toBe(1);
    expect(minimalTheme.colors.primary).toBe('white');
    expect(defaultTheme.colors.primary).toBe('blue');
  });
});
