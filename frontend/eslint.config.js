// The linter checks three rules of eslint-plugin-react-hooks and nothing else
// (ADR 0005, #156, #157): `rules-of-hooks`, `exhaustive-deps` and
// `static-components` (a component defined inside another component, whose
// state resets on every render), with the typescript-eslint parser so it can
// read .ts and .tsx. The plugin's recommended preset is not used: it also
// turns on the other React Compiler rules (`set-state-in-effect`, `purity`,
// `refs`, …), which reject the shared reload function the React skill uses.
// All three rules are errors, and `pnpm lint` also fails on any warning
// (`--max-warnings=0`).
import { defineConfig } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default defineConfig([
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/static-components': 'error',
    },
  },
])
