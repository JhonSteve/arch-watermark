# arch-水印
arch 水印 PWA 版本

## 使用方式
直接打开 `index.html`，或在项目根目录运行一个静态服务器（如 `npx serve .`），即可在浏览器或 PWA 中访问页面。

## 测试
本项目为纯前端应用，当前提供基础的语法检查以避免明显错误：

```bash
node --check script.js
```

如需格式校验，可使用 Prettier：

```bash
npx prettier --check index.html script.js style.css
```
