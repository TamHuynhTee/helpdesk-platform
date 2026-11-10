import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:shared'] },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: ['scope:api', 'scope:shared', 'scope:data'],
            },
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
            { sourceTag: 'scope:data', onlyDependOnLibsWithTags: ['scope:shared', 'scope:data'] },
            // Domain libs must not import each other; they go through api/tenancy.
            {
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: ['type:tenancy', 'scope:shared', 'scope:data'],
            },
          ],
        },
      ],
    },
  },
  {
    // Only libs/data-access/prisma may touch the raw Prisma client (it turns this rule off).
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                'Import the tenant-scoped client from @helpdesk/prisma. The raw client is allowed only in libs/data-access/prisma.',
            },
          ],
          patterns: ['@prisma/client/*'],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
