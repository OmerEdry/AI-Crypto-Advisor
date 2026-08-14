import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // TypeScript resolves identifiers itself and knows the Node globals; ESLint's no-undef
      // does not, so leaving it on reports false positives for `process` and friends.
      'no-undef': 'off',
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // Express identifies error middleware by arity, so an unused `next` must stay declared.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  prettier,
);
