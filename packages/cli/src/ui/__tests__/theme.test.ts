import { describe, it, expect } from 'vitest';
import { defaultTheme, getThemeColor, getBorderStyle } from '../theme.js';

describe('Theme Configuration', () => {
  it('should have all required color properties', () => {
    const requiredColors = [
      'primary', 'secondary', 'success', 'warning', 
      'error', 'info', 'muted', 'text', 'background'
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
  });

  it('should have spacing configuration', () => {
    expect(defaultTheme.spacing).toBeDefined();
    expect(typeof defaultTheme.spacing.small).toBe('number');
    expect(typeof defaultTheme.spacing.medium).toBe('number');
    expect(typeof defaultTheme.spacing.large).toBe('number');
  });

  it('should return correct colors from getThemeColor', () => {
    expect(getThemeColor('primary')).toBe('blue');
    expect(getThemeColor('success')).toBe('green');
    expect(getThemeColor('error')).toBe('red');
    expect(getThemeColor('warning')).toBe('yellow');
  });

  it('should return correct border style', () => {
    expect(getBorderStyle()).toBe('single');
  });
});
