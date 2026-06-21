// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.angular/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // Project uses both the default `app` prefix and the `fs` house prefix
      // (shared components like <fs-chart>).
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: ['app', 'fs'], style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: ['app', 'fs'], style: 'kebab-case' },
      ],
      // `(cancel)` etc. are deliberate component output names; track, don't block.
      '@angular-eslint/no-output-native': 'warn',
      // Pragmatic baseline so the gate is green today; ratchet these up over time.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // `x != null` is the idiomatic "not null and not undefined" template guard.
      '@angular-eslint/template/eqeqeq': ['error', { allowNullOrUndefined: true }],
      // Known a11y debt (e.g. clickable rows in settings); surfaced as warnings.
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/interactive-supports-focus': 'warn',
    },
  },
);
