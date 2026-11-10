// Commit format: <type>(<optional scope>): <required description>
// Examples: feat(auth): add login endpoint
//           docs: update architecture diagram
export const TYPES = [
  'feat',
  'fix',
  'chore',
  'docs',
  'infra',
  'update',
  'merge',
  'conflict',
];

export default {
  parserPreset: {
    parserOpts: {
      // scope is a single token (no spaces, no parentheses)
      headerPattern: /^([a-z]+)(?:\(([^\s()]+)\))?: (.+)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
  rules: {
    'type-empty': [2, 'never'],
    'type-enum': [2, 'always', TYPES],
    'scope-empty': [0],
    'subject-empty': [2, 'never'],
    'subject-min-length': [2, 'always', 5],
    'header-max-length': [2, 'always', 100],
  },
};
