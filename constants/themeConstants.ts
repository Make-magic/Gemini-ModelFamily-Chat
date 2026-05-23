
import { Theme, ThemeColors } from '../types/theme';

export const ONYX_THEME_COLORS: ThemeColors = {
  // Backgrounds — 千里江山 (Vast Mountains & Rivers)
  bgPrimary: '#141A1C',     // 鸦青 (Raven Cyan) - Main Content
  bgSecondary: '#1E292C',   // 苍黛 (Dark Ash Green) - Sidebar/Header
  bgTertiary: '#283538',    // 黯 (Dim) - Hover states
  bgAccent: '#0F59A4',      // 点翠 (Kingfisher Blue) - Vibrant Accent
  bgAccentHover: '#0D4A87', // 深点翠 - Accent Hover
  bgDanger: '#82202B',      // 殷红 (Dark Red)
  bgDangerHover: '#6B1A23', // 暗殷红
  bgInput: '#1A2426',       // 深苍 - Input area
  bgCodeBlock: '#1A2426',   // 深苍 - Code block
  bgCodeBlockHeader: '#223033', // 略亮苍黛 - Code header
  bgUserMessage: '#24746F', // 深石绿 (Dark Mineral Green) - User bubble
  bgModelMessage: 'transparent',
  bgErrorMessage: 'rgba(130, 32, 43, 0.25)',
  bgSuccess: 'rgba(26, 104, 64, 0.25)',
  textSuccess: '#45B787',   // 竹青 (Bamboo Green)
  bgInfo: 'rgba(15, 89, 164, 0.2)',
  textInfo: '#5EABD4',      // 天水碧
  bgWarning: 'rgba(141, 75, 54, 0.25)',
  textWarning: '#D4956A',   // 淡驼色

  // Text
  textPrimary: '#D6ECF0',   // 月白 (Moon White)
  textSecondary: '#8A989F', // 云水 (Cloud Water)
  textTertiary: '#556468',  // 暗云水
  textAccent: '#D6ECF0',    // 月白
  textDanger: '#D4726C',    // 淡殷红
  textLink: '#5EABD4',      // 天水碧
  textCode: '#C8DDE2',      // 淡月白
  bgUserMessageText: '#D6ECF0',
  bgModelMessageText: '#C8DDE2',
  bgErrorMessageText: '#D4726C',

  // Borders
  borderPrimary: '#2D3C40', // 铁色 (Iron)
  borderSecondary: '#344548', // 略亮铁色
  borderFocus: '#0F59A4',   // 点翠

  // Scrollbar
  scrollbarThumb: '#344548',
  scrollbarTrack: 'transparent',

  // Icons
  iconUser: '#D6ECF0',
  iconModel: '#5EABD4',     // 天水碧
  iconError: '#C3272B',     // 胭脂
  iconThought: '#556468',
  iconSettings: '#8A989F',
  iconClearChat: '#D6ECF0',
  iconSend: '#D6ECF0',
  iconAttach: '#8A989F',
  iconStop: '#D6ECF0',
  iconEdit: '#8A989F',
  iconHistory: '#8A989F',
};

export const PEARL_THEME_COLORS: ThemeColors = {
  // Backgrounds — 水墨绢本 (Ink & Silk)
  bgPrimary: '#F5F4EE',     // 素色 (Plain) - Main Content
  bgSecondary: '#E9E4D4',   // 缟色 (Unbleached Silk) - Sidebar/Header
  bgTertiary: '#DDD8C8',    // 淡缟色 - Hover states
  bgAccent: '#1661AB',      // 石青 (Mineral Blue) - Accent
  bgAccentHover: '#124D89', // 深石青 - Accent Hover
  bgDanger: '#C3272B',      // 胭脂 (Rouge)
  bgDangerHover: '#A32024', // 暗胭脂
  bgInput: '#F5F4EE',       // 素色 - Input area
  bgCodeBlock: '#EDEADF',   // 淡绢色 - Code block
  bgCodeBlockHeader: '#E4E0D2', // 略深绢色 - Code header
  bgUserMessage: '#57C3C2', // 石绿 (Mineral Green) - User bubble
  bgModelMessage: '#FFFFFF', // 纯白 - AI bubble
  bgErrorMessage: 'rgba(195, 39, 43, 0.08)',
  bgSuccess: 'rgba(69, 183, 135, 0.1)',
  textSuccess: '#2D8F60',   // 深竹青
  bgInfo: 'rgba(22, 97, 171, 0.06)',
  textInfo: '#1661AB',      // 石青
  bgWarning: 'rgba(225, 176, 87, 0.12)',
  textWarning: '#9A7B2C',   // 深秋香

  // Text
  textPrimary: '#22252A',   // 玄青 (Dark Cyan-Black)
  textSecondary: '#5C6366', // 蟹壳青 (Crab Shell Cyan)
  textTertiary: '#8C9196',  // 淡蟹壳青
  textAccent: '#F5F4EE',    // 素色
  textDanger: '#C3272B',    // 胭脂
  textLink: '#1661AB',      // 石青
  textCode: '#22252A',      // 玄青
  bgUserMessageText: '#F5F4EE', // 素色 (on green bubble)
  bgModelMessageText: '#22252A', // 玄青
  bgErrorMessageText: '#C3272B', // 胭脂

  // Borders
  borderPrimary: '#D1C7B7', // 香色 (Incense)
  borderSecondary: '#C8BDA9', // 深香色
  borderFocus: '#1661AB',   // 石青

  // Scrollbar
  scrollbarThumb: '#C8BDA9',
  scrollbarTrack: '#E9E4D4',

  // Icons
  iconUser: '#22252A',
  iconModel: '#1661AB',     // 石青
  iconError: '#C3272B',     // 胭脂
  iconThought: '#5C6366',
  iconSettings: '#5C6366',
  iconClearChat: '#F5F4EE',
  iconSend: '#F5F4EE',
  iconAttach: '#5C6366',
  iconStop: '#F5F4EE',
  iconEdit: '#5C6366',
  iconHistory: '#5C6366',
};

export const AVAILABLE_THEMES: Theme[] = [
  { id: 'onyx', name: '千里江山 (Dark)', colors: ONYX_THEME_COLORS },
  { id: 'pearl', name: '水墨绢本 (Light)', colors: PEARL_THEME_COLORS },
];

export const DEFAULT_THEME_ID = 'pearl';
