import { createRequire } from "module";

const require = createRequire(import.meta.url);

// eslint-config-next ships as CJS flat-config arrays; spread them directly
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [...nextCoreWebVitals];

export default eslintConfig;
