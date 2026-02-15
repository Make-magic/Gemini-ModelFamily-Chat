# PDF 导出功能修复报告 (Fix Report)

## 1. 问题描述 (Problem)
用户反馈 PDF 导出功能（包括单次消息导出和完整会话导出）生成的文档为空白，仅显示一页，且内容完全缺失。

## 2. 根因分析 (Root Cause Analysis)
经过深度扫描 `utils/export/pdfFromMarkdown.ts` 及其相关调用链，发现以下逻辑漏洞：

- **视口捕获偏移**：原实现使用 `position: fixed; top: 0;`。当页面存在滚动条时，`html2canvas` 会按照当前视口位置进行截图，导致捕获到导出容器上方的空白区域。
- **样式隔离 (Style Isolation)**：导出容器是动态插入到 `body` 的孤立节点，未包含 `index.html` 中通过 `<link>` 引入的 Markdown 和语法高亮样式，导致渲染结果失去样式支撑。
- **深色模式冲突**：在系统开启深色模式时，虽然 PDF 容器背景硬编码为白色，但文字颜色仍继承了深色模式的 CSS 变量（接近白色），导致“白底白字”的视觉消失。
- **异步渲染竞态**：`marked.parse` 与样式加载需要时间，原有的 500ms `setTimeout` 不足以保证所有 CSS 规则（尤其是外部字体和复杂表格样式）解析完成。
- **API 调用不当**：`html2pdf` 的链式调用顺序存在微弱瑕疵，未充分利用其 Worker 模式进行可靠生成。

## 3. 修复方案 (Solution)

### 3.1 定位策略优化
- 将容器定位改为 `position: absolute; left: -9999px; top: 0;`。
- 在 `html2canvas` 配置中显式强制 `scrollY: 0` 和 `scrollX: 0`。
- 确保导出过程不受主界面滚动状态影响。

### 3.2 样式注入增强
- 引入 `gatherPageStyles` 工具函数，自动抓取当前页面的所有 `<style>` 和外部 `<link rel="stylesheet">` 内容，并内联注入到导出容器中。
- 确保 `.markdown-body` 和 `highlight.js` 样式在 PDF 容器内生效。

### 3.3 强制高对比度覆盖
- 针对 PDF 导出环境，在注入的 CSS 中增加了 `@media all` 的强力覆盖：
  - 强制背景为 `#FFFFFF !important`。
  - 强制正文颜色为 `#000000 !important`。
  - 重新定义代码块 (`pre`, `code`)、引用 (`blockquote`) 和表格 (`table`) 的浅色边框与背景。

### 3.4 渲染流程加固
- 将渲染沉淀时间从 **500ms 延长至 1500ms**。
- 优化 `html2pdf` 调用链：`html2pdf().from(element).set(opt).save()`。
- 确保在调用 `.save()` 前，DOM 树已经过 `hljs.highlightElement` 同步处理。

## 4. 验证结果 (Verification)
- [x] 单次消息导出 PDF：文字、代码块、附件列表清晰可见。
- [x] 完整会话导出 PDF：多页分页正常，自动避开图片/消息块截断。
- [x] 深色模式导出兼容性：导出结果保持白底黑字的标准文档格式。
