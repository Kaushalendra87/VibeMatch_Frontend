/**
 * ESLint, flat config.
 *
 * Two rule choices worth explaining, because both are deliberate rather
 * than defaults:
 *
 * * `react-hooks/exhaustive-deps` is a **warning**, not an error. There
 *   are a handful of places where a dependency is intentionally omitted
 *   and the reason is in a comment (the photo-order sync in
 *   `PhotoManager` is the clearest). Failing the build on those would
 *   push the next person to silence the rule globally instead.
 * * `no-unused-vars` ignores capitalised names, because a component
 *   imported for its JSX usage is referenced in a way this rule cannot
 *   always see across files.
 */

import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/**', 'node_modules/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,

      // The app does not use PropTypes — the props are documented in the
      // component's header comment instead.
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': 'warn',

      // Downgraded to a warning. The rule is aimed at derived state that
      // should be computed during render, but it also fires on three
      // patterns here that are correct and idiomatic: closing the mobile
      // drawer when the route changes, applying a theme preference to
      // `<html>`, and resetting state when the session ends. Rewriting
      // those to satisfy it would be worse code, not better.
      'react-hooks/set-state-in-effect': 'warn',

      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]
