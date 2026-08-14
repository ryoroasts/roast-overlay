import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 純クライアント静的アプリ。base を相対にしておくと
// GitHub Pages / Cloudflare Pages 等どこに置いてもそのまま動く。
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
