import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig({
  plugins: [uni()],
  css: {
    postcss: {
      plugins: [
        // rpx to rem is handled by uni-app plugin, but ensure proper conversion
      ]
    }
  },
  // Ensure proper mobile viewport
  server: {
    host: "0.0.0.0"
  }
});
