// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_THEMES,
  CLAUDE_DARK_THEME_COLORS,
  CLAUDE_LIGHT_THEME_COLORS,
  isDarkThemeId,
} from '../constants/themeConstants';
import { DEFAULT_APP_SETTINGS } from '../constants/appConstants';
import { applyThemeToDocument, generateThemeCssVariables } from '../utils/uiUtils';

describe('Claude themes', () => {
  it('registers the warm sand and warm charcoal palettes', () => {
    expect(AVAILABLE_THEMES.find(theme => theme.id === 'claude-light')?.colors).toBe(CLAUDE_LIGHT_THEME_COLORS);
    expect(AVAILABLE_THEMES.find(theme => theme.id === 'claude-dark')?.colors).toBe(CLAUDE_DARK_THEME_COLORS);
    expect(CLAUDE_LIGHT_THEME_COLORS.bgPrimary).toBe('#FAF9F6');
    expect(CLAUDE_DARK_THEME_COLORS.bgPrimary).toBe('#222220');
  });

  it('emits the Claude palette as CSS custom properties', () => {
    const css = generateThemeCssVariables(CLAUDE_LIGHT_THEME_COLORS);

    expect(css).toContain('--theme-bg-primary: #FAF9F6;');
    expect(css).toContain('--theme-bg-accent: #D97757;');
    expect(css).toContain('--theme-icon-model: #D97757;');
  });

  it('applies Claude warm charcoal as a complete dark theme', () => {
    document.head.innerHTML = `
      <meta name="color-scheme" content="light dark">
      <meta name="theme-color" content="#FFFFFF">
      <style id="theme-variables"></style>
      <link id="markdown-dark-theme"><link id="markdown-light-theme">
      <link id="hljs-dark-theme"><link id="hljs-light-theme">
    `;
    document.body.className = 'theme-pearl';

    const theme = AVAILABLE_THEMES.find(candidate => candidate.id === 'claude-dark')!;
    applyThemeToDocument(document, theme, DEFAULT_APP_SETTINGS);

    expect(isDarkThemeId(theme.id)).toBe(true);
    expect(document.body.classList.contains('theme-claude-dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#222220');
    expect((document.getElementById('markdown-dark-theme') as HTMLLinkElement).disabled).toBe(false);
    expect((document.getElementById('markdown-light-theme') as HTMLLinkElement).disabled).toBe(true);
  });
});
