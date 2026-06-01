// https://docs.expo.dev/guides/using-eslint/
import importPlugin from "eslint-plugin-import";
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ["dist/*"],
    extends: [importPlugin.flatConfigs.recommended],
  },
  {
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
]);
