// @ts-check
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config for the PlanMap monorepo.
 *
 * NOTE (plan Task C1): the core-first boundary rule is added here later —
 * forbid domain/filesystem/db/network imports from `apps/*` and `packages/ui`
 * so that all business logic stays in `@planmap/core`.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'examples/**',
      'docs/**',
      'Files/**',
      '.remember/**',
      '**/*.config.{js,mjs,cjs,ts}',
      'coverage/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
