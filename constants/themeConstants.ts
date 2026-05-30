
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
  bgUserMessage: '#5D828A', // 石绿 (Mineral Green) - User bubble
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

export const WENXIN_THEME_COLORS: ThemeColors = {
  // Backgrounds — 文心雕龙 (Wen Xin Diao Long)
  bgPrimary: '#F5F4F1',     // 鱼肚白 - Main Content
  bgSecondary: '#E8E6DF',   // 略深的纸张色 - Sidebar/Header
  bgTertiary: '#DCD8D0',    // 更深的纸张色 - Hover states
  bgAccent: '#8F4B4A',      // 檀唇 - Accent
  bgAccentHover: '#7A3F3F', // 深檀唇 - Accent Hover
  bgDanger: '#C3272B',      // 胭脂
  bgDangerHover: '#A32024',
  bgInput: '#F5F4F1',       // 鱼肚白
  bgCodeBlock: '#EDEADF',
  bgCodeBlockHeader: '#E4E0D2',
  bgUserMessage: '#5C695B', // 蟹壳青
  bgModelMessage: '#FFFFFF',
  bgErrorMessage: 'rgba(195, 39, 43, 0.08)',
  bgSuccess: 'rgba(69, 183, 135, 0.1)',
  textSuccess: '#2D8F60',
  bgInfo: 'rgba(143, 75, 74, 0.06)',
  textInfo: '#8F4B4A',      // 檀唇
  bgWarning: 'rgba(176, 160, 128, 0.15)',
  textWarning: '#B0A080',   // 古铜

  // Text
  textPrimary: '#252324',   // 墨黑
  textSecondary: '#5C695B', // 蟹壳青
  textTertiary: '#8C9196',
  textAccent: '#F5F4F1',    // 鱼肚白
  textDanger: '#C3272B',
  textLink: '#8F4B4A',      // 檀唇
  textCode: '#252324',
  bgUserMessageText: '#F5F4F1',
  bgModelMessageText: '#252324',
  bgErrorMessageText: '#C3272B',

  // Borders
  borderPrimary: '#DCD8D0',
  borderSecondary: '#C8BDA9',
  borderFocus: '#8F4B4A',   // 檀唇

  // Scrollbar
  scrollbarThumb: '#C8BDA9',
  scrollbarTrack: '#E8E6DF',

  // Icons
  iconUser: '#252324',
  iconModel: '#8F4B4A',     // 檀唇
  iconError: '#C3272B',
  iconThought: '#B0A080',   // 古铜
  iconSettings: '#5C695B',  // 蟹壳青
  iconClearChat: '#F5F4F1',
  iconSend: '#F5F4F1',
  iconAttach: '#5C695B',
  iconStop: '#F5F4F1',
  iconEdit: '#5C695B',
  iconHistory: '#5C695B',
};

export const GEWU_THEME_COLORS: ThemeColors = {
  // Backgrounds — 格物致知 (Ge Wu Zhi Zhi)
  bgPrimary: '#F0F2F4',     // 月白 - Main Content
  bgSecondary: '#E4E8EC',   // 略深的蓝灰 - Sidebar/Header
  bgTertiary: '#D8DEE4',    // 更深的蓝灰 - Hover states
  bgAccent: '#2A5CAA',      // 靛蓝 - Accent
  bgAccentHover: '#1E4685', // 深靛蓝 - Accent Hover
  bgDanger: '#C3272B',      // 胭脂
  bgDangerHover: '#A32024',
  bgInput: '#F0F2F4',       // 月白
  bgCodeBlock: '#E4E8EC',
  bgCodeBlockHeader: '#D8DEE4',
  bgUserMessage: '#789262', // 竹青
  bgModelMessage: '#FFFFFF',
  bgErrorMessage: 'rgba(195, 39, 43, 0.08)',
  bgSuccess: 'rgba(120, 146, 98, 0.15)',
  textSuccess: '#789262',
  bgInfo: 'rgba(42, 92, 170, 0.08)',
  textInfo: '#2A5CAA',      // 靛蓝
  bgWarning: 'rgba(225, 164, 81, 0.15)',
  textWarning: '#E1A451',   // 秋香

  // Text
  textPrimary: '#1C2327',   // 玄青
  textSecondary: '#5C6366',
  textTertiary: '#8C9196',
  textAccent: '#F0F2F4',    // 月白
  textDanger: '#C3272B',
  textLink: '#2A5CAA',      // 靛蓝
  textCode: '#1C2327',
  bgUserMessageText: '#F0F2F4',
  bgModelMessageText: '#1C2327',
  bgErrorMessageText: '#C3272B',

  // Borders
  borderPrimary: '#D8DEE4',
  borderSecondary: '#C5CDD4',
  borderFocus: '#2A5CAA',   // 靛蓝

  // Scrollbar
  scrollbarThumb: '#C5CDD4',
  scrollbarTrack: '#E4E8EC',

  // Icons
  iconUser: '#1C2327',
  iconModel: '#2A5CAA',     // 靛蓝
  iconError: '#C3272B',
  iconThought: '#789262',   // 竹青
  iconSettings: '#5C6366',
  iconClearChat: '#F0F2F4',
  iconSend: '#F0F2F4',
  iconAttach: '#5C6366',
  iconStop: '#F0F2F4',
  iconEdit: '#5C6366',
  iconHistory: '#5C6366',
};

export const JINGSHI_THEME_COLORS: ThemeColors = {
  // Backgrounds — 经世致用 (Jing Shi Zhi Yong)
  bgPrimary: '#FAF9E6',     // 浅缃 - Main Content
  bgSecondary: '#F2EFD9',   // 略深缃色 - Sidebar/Header
  bgTertiary: '#EAE5CC',    // 更深缃色 - Hover states
  bgAccent: '#437272',      // 沧浪 - Accent
  bgAccentHover: '#335959', // 深沧浪 - Accent Hover
  bgDanger: '#9F5454',      // 朱槿
  bgDangerHover: '#804343',
  bgInput: '#FAF9E6',       // 浅缃
  bgCodeBlock: '#F2EFD9',
  bgCodeBlockHeader: '#EAE5CC',
  bgUserMessage: '#437272', // 沧浪
  bgModelMessage: '#FFFFFF',
  bgErrorMessage: 'rgba(159, 84, 84, 0.08)',
  bgSuccess: 'rgba(67, 114, 114, 0.1)',
  textSuccess: '#437272',   // 沧浪
  bgInfo: 'rgba(198, 121, 21, 0.08)',
  textInfo: '#C67915',      // 赭黄
  bgWarning: 'rgba(159, 84, 84, 0.15)',
  textWarning: '#9F5454',   // 朱槿

  // Text
  textPrimary: '#36282B',   // 铁褐
  textSecondary: '#665558', // 浅铁褐
  textTertiary: '#8C7A7D',
  textAccent: '#FAF9E6',    // 浅缃
  textDanger: '#9F5454',
  textLink: '#437272',      // 沧浪
  textCode: '#36282B',
  bgUserMessageText: '#FAF9E6',
  bgModelMessageText: '#36282B',
  bgErrorMessageText: '#9F5454',

  // Borders
  borderPrimary: '#EAE5CC',
  borderSecondary: '#D6CFB3',
  borderFocus: '#437272',   // 沧浪

  // Scrollbar
  scrollbarThumb: '#D6CFB3',
  scrollbarTrack: '#F2EFD9',

  // Icons
  iconUser: '#36282B',
  iconModel: '#437272',     // 沧浪
  iconError: '#9F5454',
  iconThought: '#C67915',   // 赭黄
  iconSettings: '#665558',
  iconClearChat: '#FAF9E6',
  iconSend: '#FAF9E6',
  iconAttach: '#665558',
  iconStop: '#FAF9E6',
  iconEdit: '#665558',
  iconHistory: '#665558',
};

export const CLASSIC_LIGHT_THEME_COLORS: ThemeColors = {
  // Backgrounds
  bgPrimary: '#FFFFFF',
  bgSecondary: '#f9f9f9',
  bgTertiary: '#ECECF1',
  bgAccent: '#40414F',
  bgAccentHover: '#202123',
  bgDanger: '#DF3434',
  bgDangerHover: '#B32929',
  bgInput: '#FFFFFF',
  bgCodeBlock: '#F7F7F8',
  bgCodeBlockHeader: 'rgba(236, 236, 241, 0.9)',
  bgUserMessage: '#f3f4f6', // Light Gray
  bgModelMessage: '#FFFFFF', // White
  bgErrorMessage: '#FEE',
  bgSuccess: 'rgba(22, 163, 74, 0.1)',
  textSuccess: '#16a34a',
  bgInfo: 'rgba(64, 65, 79, 0.05)',
  textInfo: '#40414F',
  bgWarning: 'rgba(212, 167, 44, 0.1)',
  textWarning: '#825F0A',

  // Text
  textPrimary: '#000000',
  textSecondary: '#000000',
  textTertiary: '#666666',
  textAccent: '#FFFFFF',
  textDanger: '#DF3434',
  textLink: '#2563eb',
  textCode: '#000000',
  bgUserMessageText: '#000000',
  bgModelMessageText: '#000000',
  bgErrorMessageText: '#DF3434',

  // Borders
  borderPrimary: '#E5E5E5',
  borderSecondary: '#D9D9E3',
  borderFocus: '#40414F',

  // Scrollbar
  scrollbarThumb: '#D9D9E3',
  scrollbarTrack: '#F7F7F8',

  // Icons
  iconUser: '#202123',
  iconModel: '#10a37f',
  iconError: '#DF3434',
  iconThought: '#323232',
  iconSettings: '#000000',
  iconClearChat: '#FFFFFF',
  iconSend: '#FFFFFF',
  iconAttach: '#323232',
  iconStop: '#FFFFFF',
  iconEdit: '#323232',
  iconHistory: '#000000',
};

export const AVAILABLE_THEMES: Theme[] = [
  { id: 'onyx', name: '千里江山 (Dark)', colors: ONYX_THEME_COLORS },
  { id: 'pearl', name: '水墨绢本 (Light)', colors: PEARL_THEME_COLORS },
  { id: 'wenxin', name: '文心雕龙 (Reading)', colors: WENXIN_THEME_COLORS },
  { id: 'gewu', name: '格物致知 (STEM)', colors: GEWU_THEME_COLORS },
  { id: 'jingshi', name: '经世致用 (Practical)', colors: JINGSHI_THEME_COLORS },
  { id: 'classic-light', name: '默认浅色 (Classic Light)', colors: CLASSIC_LIGHT_THEME_COLORS },
];

export const DEFAULT_THEME_ID = 'classic-light';
