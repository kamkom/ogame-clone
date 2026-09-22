import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';

// Ban Date.now() outside the system clock: time must come from the injected Clock.
const noDateNow = {
  'no-restricted-properties': [
    'error',
    {
      object: 'Date',
      property: 'now',
      message: 'Do not read the wall clock directly. Use the injected Clock (server/clock.ts).',
    },
  ],
};

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'design', 'coverage', '.sandcastle', '*.html'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
    rules: {
      // Source-root boundaries: web ↛ server, shared ↛ either.
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            { target: './web', from: './server', message: 'web must not import from server.' },
            {
              target: './shared',
              from: './server',
              message: 'shared must not import from server.',
            },
            { target: './shared', from: './web', message: 'shared must not import from web.' },
          ],
        },
      ],
    },
  },
  // Wall-clock ban in server and shared code...
  {
    files: ['server/**/*.ts', 'shared/**/*.ts'],
    rules: noDateNow,
  },
  // ...except the system clock, which is the one place allowed to read it.
  {
    files: ['server/clock.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },
  // React hooks rules for the web shell.
  {
    files: ['web/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // Test files may use dev dependencies freely.
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
