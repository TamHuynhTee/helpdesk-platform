import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
          // Declared at the workspace root only: a lib-level @prisma/client link
          // breaks `prisma generate` with pnpm ("Could not resolve @prisma/client").
          ignoredDependencies: ['@prisma/client'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    // The one place allowed to import the raw Prisma client.
    files: ['**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    ignores: ['**/out-tsc'],
  },
];
