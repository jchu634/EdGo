// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "import/no-unresolved": [
        "error",
        { ignore: ["^@shikijs/langs/", "^@shikijs/themes/"] },
      ],
    },
  },
]);
