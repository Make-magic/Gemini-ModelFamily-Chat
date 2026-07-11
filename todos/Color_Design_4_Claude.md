# Claude 官网色彩体系适配与迁移计划 (Claude Color Design Migration Plan)

本计划旨在将 Anthropic 旗下 **Claude.ai** 官方聊天站点的温暖、人文、高阶质感的色彩设计系统（Color Design System）迁移并适配至本项目中。

> [!NOTE]
> 本文档仅作为设计与迁移计划方案，遵循用户指令，未对项目中的实际代码文件进行任何修改。

---

## 1. 调研分析：Anthropic Claude 色彩体系

Anthropic 摒弃了科技行业传统的“冷色调/高饱和蓝”风格，转而采用以“砂土（Sand）”、“陶土（Terracotta）”和“木炭（Charcoal）”为核心的暖色调体系，这为用户带来了极高的人文质感和长时间使用的视觉舒适度。

### 1.1 核心色彩（Design Tokens）
*   **砂土黄 (Claude Sand - Light Base):** `#FAF9F6`（或 `#FAF9F5`）。界面主背景色，呈现温润的米白色，减少白光刺眼。
*   **浅灰褐 (Claude Warm Grey/Sidebar):** `#F1F0E8`（或 `#E8E6DC`）。主要用于侧边栏、卡片和次要工作区背景。
*   **陶土桔 (Claude Terracotta - Primary Accent):** `#D97757`（或 `#DE7356`）。主品牌色与强调色，用于重要按钮、链接、高亮状态。
*   **木炭黑 (Claude Charcoal - Text/Dark Base):** `#191919`（或 `#141413`）。浅色模式下的主文字色，以及深色模式的极限背景/文字色。
*   **深暖褐 (Claude Dark Mode Content):** `#222220`（或 `#262624`）。深色模式下的主背景，带有一丝暖调，比纯黑更温和。
*   **深侧边栏 (Claude Dark Mode Sidebar):** `#1B1B19`（或 `#1E1E1C`）。深色模式的侧边栏与标题栏，略深于主背景。
*   **人文绿 (Claude Green - Brand Accent):** `#788C5D`。用于成功状态、模型切换提示等。
*   **人文蓝 (Claude Blue - Secondary Brand Accent):** `#6A9BCC`。用于信息提示与次要操作。

---

## 2. 项目现状扫描与适配分析

经过对项目的扫描，色彩体系主要依靠以下两个层级进行驱动和应用：

1.  **TypeScript 静态主题定义 (`/types/theme.ts` & `/constants/themeConstants.ts`):**
    *   `types/theme.ts` 定义了包含 57 个色彩字段的 `ThemeColors` 接口，主要分为 `Backgrounds`、`Text`、`Borders`、`Scrollbar` 和 `Icons` 五大类。
    *   `constants/themeConstants.ts` 定义了多个内置主题（如 `ONYX_THEME_COLORS`、`PEARL_THEME_COLORS` 等）并统一注册在 `AVAILABLE_THEMES` 数组中。
2.  **CSS 全局样式渲染 (`/styles/main.css` & `/utils/uiUtils.ts`):**
    *   在运行时，`uiUtils.ts` 内的 `applyThemeToDocument` 函数会将当前激活主题的 `ThemeColors` 对象转化为 kebab-case 格式 of CSS 自定义属性（例如：`bgPrimary` -> `--theme-bg-primary`），并动态写入 `<style id="theme-variables">` 中。
    *   `styles/main.css` 对特定主题（如 `.theme-pearl`）定义了特有的选区高亮色 (`::selection`)、阴影 (`--shadow-ink`) 和特殊的背景噪点背景图。

---

## 3. 色彩适配方案设计

我们计划在项目中新增两个主题：
*   **`claude-light` (Claude 暖砂 - Light)**
*   **`claude-dark` (Claude 暖炭 - Dark)**

### 3.1 `ThemeColors` 对象精密映射表

以下为针对 `types/theme.ts` 的 `ThemeColors` 接口属性，精心适配的 Claude 参数表：

| 属性名 (Key) | Claude Light 推荐色值 | Claude Dark 推荐色值 | 视觉设计说明 |
| :--- | :--- | :--- | :--- |
| **[Backgrounds]** | | | |
| `bgPrimary` | `#FAF9F6` | `#222220` | 主工作区/聊天面板背景。浅色为温润砂土色，深色为暖炭色。 |
| `bgSecondary` | `#F1F0E8` | `#1B1B19` | 侧边栏/头部面板背景。深/浅色均呈现层次对比。 |
| `bgTertiary` | `#E2DFD3` | `#2E2E2B` | 悬停状态（Hover）背景。 |
| `bgAccent` | `#D97757` | `#DE7356` | 陶土桔。品牌主操作色。 |
| `bgAccentHover` | `#C86548` | `#C86548` | 陶土桔悬停变暗。 |
| `bgDanger` | `#E05C5C` | `#822B2B` | 警示/危险操作背景。 |
| `bgDangerHover` | `#C94646` | `#6B2020` | 危险操作悬停。 |
| `bgInput` | `#FAF9F6` | `#222220` | 聊天输入框背景。与主工作区融合。 |
| `bgCodeBlock` | `#F1F0E8` | `#1B1B19` | 代码块背景，带暖色调。 |
| `bgCodeBlockHeader` | `#E2DFD3` | `#262624` | 代码块头部背景。 |
| `bgUserMessage` | `#F1F0E8` | `#2E2E2B` | 用户发言气泡。浅色为砂土灰，深色为深炭灰。 |
| `bgModelMessage` | `transparent` | `transparent` | AI 回复背景。Claude 官网采用无边框透明融合设计。 |
| `bgErrorMessage` | `rgba(224,92,92,0.08)` | `rgba(130,43,43,0.25)` | 错误框背景。 |
| `bgSuccess` | `rgba(120,140,93,0.1)` | `rgba(120,140,93,0.2)` | 成功状态背景，采用 Claude 人文绿。 |
| `textSuccess` | `#5E6E45` | `#8CA56C` | 成功文本色。 |
| `bgInfo` | `rgba(106,155,204,0.1)` | `rgba(106,155,204,0.2)` | 信息提示背景，采用 Claude 人文蓝。 |
| `textInfo` | `#4E78A2` | `#8FB4DB` | 信息文本色。 |
| `bgWarning` | `rgba(217,119,87,0.1)` | `rgba(222,115,86,0.2)` | 警示背景，浅陶土色。 |
| `textWarning` | `#B85B3D` | `#EBA28D` | 警示文本色。 |
| **[Text]** | | | |
| `textPrimary` | `#191919` | `#FAF9F6` | 主要文字色。高对比度且不易疲劳。 |
| `textSecondary` | `#666560` | `#B0AEA5` | 次要文字色（时间、副标题）。 |
| `textTertiary` | `#9E9D95` | `#7A7872` | 占位文字/辅助说明。 |
| `textAccent` | `#FAF9F6` | `#FAF9F6` | 强调状态下的反色文字（如按钮文字）。 |
| `textDanger` | `#C94646` | `#E57373` | 错误/警示文字色。 |
| `textLink` | `#D97757` | `#DE7356` | 链接文本色，采用陶土桔。 |
| `textCode` | `#191919` | `#FAF9F6` | 代码块内常规代码文本色。 |
| `bgUserMessageText` | `#191919` | `#FAF9F6` | 用户气泡内文本色。 |
| `bgModelMessageText`| `#191919` | `#FAF9F6` | AI 消息内文本色。 |
| `bgErrorMessageText`| `#C94646` | `#E57373` | 错误消息内文本色。 |
| **[Borders]** | | | |
| `borderPrimary` | `#E2DFD3` | `#30302E` | 边框/主分隔线。 |
| `borderSecondary` | `#D5D2C4` | `#3D3D39` | 卡片/菜单内部等次要分隔线。 |
| `borderFocus` | `#D97757` | `#DE7356` | 输入框/元素聚焦轮廓线。 |
| **[Scrollbar]** | | | |
| `scrollbarThumb` | `#D5D2C4` | `#3D3D39` | 滚动条滑块。 |
| `scrollbarTrack` | `transparent` | `transparent` | 滚动条轨道。 |
| **[Icons]** | | | |
| `iconUser` | `#191919` | `#FAF9F6` | 用户图标。 |
| `iconModel` | `#D97757` | `#DE7356` | AI 助手图标（陶土桔凸显品牌）。 |
| `iconError` | `#C94646` | `#E57373` | 错误图标。 |
| `iconThought` | `#9E9D95` | `#7A7872` | 思考状态/中间过程图标。 |
| `iconSettings` | `#666560` | `#B0AEA5` | 设置图标。 |
| `iconClearChat` | `#191919` | `#FAF9F6` | 清除聊天图标。 |
| `iconSend` | `#FAF9F6` | `#FAF9F6` | 发送按钮图标。 |
| `iconAttach` | `#666560` | `#B0AEA5` | 附件图标。 |
| `iconStop` | `#FAF9F6` | `#FAF9F6` | 停止图标。 |
| `iconEdit` | `#666560` | `#B0AEA5` | 编辑图标。 |
| `iconHistory` | `#666560` | `#B0AEA5` | 历史记录图标。 |

---

## 4. 实施迁移步骤

为将本色彩设计落地，需分步骤修改以下文件：

### 步骤一：在 `constants/themeConstants.ts` 中注册新色彩常数

1.  打开 [constants/themeConstants.ts](file:///d:/magiks/Note/CodeEnv/JS/AMC/Code/constants/themeConstants.ts)。
2.  在文件中定义并导出以下两个常量：
    *   `CLAUDE_LIGHT_THEME_COLORS: ThemeColors` (填入上方表格 Light 推荐色值)
    *   `CLAUDE_DARK_THEME_COLORS: ThemeColors` (填入上方表格 Dark 推荐色值)
3.  在底部的 `AVAILABLE_THEMES` 数组中添加以下两个新对象：
    ```typescript
    { id: 'claude-light', name: 'Claude 暖砂 (Light)', colors: CLAUDE_LIGHT_THEME_COLORS },
    { id: 'claude-dark', name: 'Claude 暖炭 (Dark)', colors: CLAUDE_DARK_THEME_COLORS },
    ```
4.  根据喜好，若希望默认使用 Claude 色彩，可将 `DEFAULT_THEME_ID` 修改为 `'claude-light'`：
    ```typescript
    export const DEFAULT_THEME_ID = 'claude-light';
    ```

### 步骤二：在 `styles/main.css` 中注入伴随样式（阴影与选区高亮）

为保持 Claude 独特的视觉微效，应在样式表中为对应类目追加阴影和选区高亮颜色。

1.  打开 [styles/main.css](file:///d:/magiks/Note/CodeEnv/JS/AMC/Code/styles/main.css)。
2.  在 `.theme-pearl` 等阴影样式区下方追加针对新主题的软化阴影（采用浅灰褐色阴影替代深黑阴影，呈现纸张质感）：
    ```css
    /* ============================================================
       Claude Theme Overrides
       ============================================================ */
    .theme-claude-light {
      --shadow-ink: 0 4px 20px rgba(102, 101, 96, 0.05);
      --shadow-ink-elevated: 0 8px 30px rgba(217, 119, 87, 0.04);
      --shadow-ink-deep: 0 12px 40px rgba(102, 101, 96, 0.08);
      --texture-xuan-paper: none;
    }
    
    .theme-claude-dark {
      --shadow-ink: 0 4px 24px rgba(0, 0, 0, 0.25);
      --shadow-ink-elevated: 0 8px 32px rgba(0, 0, 0, 0.35);
      --shadow-ink-deep: 0 12px 48px rgba(0, 0, 0, 0.45);
      --texture-xuan-paper: none;
    }
    ```
3.  在选区高亮配置区追加专属的陶土桔淡化选区背景色：
    ```css
    /* Claude Light 选区：陶土桔淡化 */
    .theme-claude-light ::selection {
      background-color: rgba(217, 119, 87, 0.25);
      color: #191919;
    }
    .theme-claude-light ::-moz-selection {
      background-color: rgba(217, 119, 87, 0.25);
      color: #191919;
    }
    
    /* Claude Dark 选区：深陶土桔淡化 */
    .theme-claude-dark ::selection {
      background-color: rgba(222, 115, 86, 0.3);
      color: #FAF9F6;
    }
    .theme-claude-dark ::-moz-selection {
      background-color: rgba(222, 115, 86, 0.3);
      color: #FAF9F6;
    }
    ```

### 步骤三：Markdown 及代码高亮跟随设定 (`utils/uiUtils.ts`)

为了确保 Markdown 组件和 Highlight.js 在深浅色切换时应用正确的主题样式：
1.  打开 [utils/uiUtils.ts](file:///d:/magiks/Note/CodeEnv/JS/AMC/Code/utils/uiUtils.ts)。
2.  在 `applyThemeToDocument` 方法中，将 `isDark` 的判定逻辑进行扩展，以包含 `claude-dark` 主题：
    ```typescript
    // 原代码: const isDark = theme.id === 'onyx';
    // 修改为:
    const isDark = theme.id === 'onyx' || theme.id === 'claude-dark';
    ```

---

## 5. 效果验证与验收计划

迁移实施完毕后，可通过以下方式进行校验，确保视觉效果的高保真呈现：

### 5.1 视觉走查检查单
- [ ] **侧边栏与主区对比度:** 检查 `claude-light` 的左侧边栏是否呈现柔和的 `#F1F0E8`，主聊天区为 `#FAF9F6`，两者对比边界清晰且柔和。
- [ ] **发送按钮与聚焦环:** 激活输入框时，聚焦环颜色应为 `#D97757`。发送按钮在有输入内容时呈现饱满的陶土桔背景，无内容时呈现优雅置灰。
- [ ] **AI 消息气泡:** 确认 AI（Model）发言区域没有白色或灰色气泡框，保持透明，且与背景自然融为一体。
- [ ] **代码块对比度:** 确认浅色模式下的代码块呈现柔和浅灰褐 (`#F1F0E8`)，深色模式呈深灰 (`#1B1B19`)，文字可读性良好。
- [ ] **深色模式和谐度:** 切换到 `claude-dark`，确认背景绝非纯黑(`#000`)，而是带有木炭暖调的深灰褐，以确保舒适的高级感。

---
*计划编制人：Linus Torvalds 继任者 (AI Senior Software Engineer)*
*编制时间：2026年7月11日*
