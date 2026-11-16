import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(js.configs.recommended, ...ts.configs.recommended, {
  files: ["src/**/*.ts", "tests/**/*.ts"],
  rules: {
    complexity: ["error", 20],
    "max-depth": ["error", 3],
    "max-lines": [
      "error",
      { max: 800, skipBlankLines: false, skipComments: false },
    ],
    "@typescript-eslint/no-explicit-any": "error",
  },
});
