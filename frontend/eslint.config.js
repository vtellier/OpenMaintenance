// The linter checks React's hooks rules and nothing else (ADR 0005): the
// recommended preset of eslint-plugin-react-hooks, with the typescript-eslint
// parser so it can read .ts and .tsx. `pnpm lint` fails on any warning.
import { defineConfig } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default defineConfig([
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    extends: [reactHooks.configs.flat.recommended],
  },
])
