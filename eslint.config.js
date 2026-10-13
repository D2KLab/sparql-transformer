import js from '@eslint/js';
import { flatConfigs } from 'eslint-plugin-import-x';
import globals from 'globals';

export default [
    {
        ignores: ['dist/', 'docs/'],
    },
    js.configs.recommended,
    flatConfigs.recommended,
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'off',
        },
    },
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'indent': ['error', 4, { SwitchCase: 1 }],
            'no-console': 'warn',
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-unused-vars': ['error', { caughtErrors: 'none' }],
        },
    },
    {
        files: ['src/debugger.mjs'],
        rules: {
            'no-console': 'off',
        },
    },
];
