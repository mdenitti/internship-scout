import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/** Flat ESLint config (ESLint 10) for Next.js 16 + TypeScript. */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // eslint-plugin-react's "detect" mode calls getFilename(), which ESLint 10 removed;
    // pinning the React version keeps the plugin working without a downgrade.
    settings: { react: { version: '19.3' } },
  },
  globalIgnores(['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts', '.data/**']),
]);

export default eslintConfig;
