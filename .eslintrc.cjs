module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier"
  ],
  settings: {
    "import/resolver": {
      typescript: true,
      node: true
    }
  },
  ignorePatterns: ["dist", "node_modules"],
  rules: {
    "@typescript-eslint/consistent-type-imports": "error",
    "import/no-unresolved": "off"
  }
};
