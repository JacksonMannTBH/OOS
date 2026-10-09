const path = require("node:path");
const loadConfig = require("tailwindcss/loadConfig");
const root = path.dirname(__dirname);
const config = loadConfig(path.join(root, "tailwind.config.ts"));

module.exports = {
  plugins: [
    require("tailwindcss")({
      ...config,
      content: [
        path.join(root, "app/**/*.{ts,tsx}"),
        path.join(root, "components/**/*.{ts,tsx}"),
        path.join(__dirname, "frontend/**/*.{ts,tsx}"),
      ],
    }),
    require("autoprefixer")(),
  ],
};
