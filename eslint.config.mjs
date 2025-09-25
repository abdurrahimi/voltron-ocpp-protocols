import path from 'path';
import { fileURLToPath } from 'url';
import typescriptEslintParser from '@typescript-eslint/parser';
import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';

// Manually define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  {
    files: ['**/*.ts', '**/*.tsx'], // Apply to TypeScript files
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        project: path.resolve(__dirname, 'tsconfig.json'),
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        ecmaVersion: 2021,
      },
      globals: {
        global: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslintPlugin,
      prettier: eslintPluginPrettier,
    },
    rules: {
      ...eslintConfigPrettier.rules, // Spread Prettier config rules
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'constructor-super': 'error',
      'getter-return': 'error',
      'no-async-promise-executor': 'error',
      'no-cond-assign': ['error', 'always'],
      'no-constant-binary-expression': 'error',
      'no-extra-boolean-cast': 'error',
      'no-implied-eval': 'error',
      'no-iterator': 'error',
      'no-labels': 'error',
      'no-lone-blocks': 'error',
      'no-lonely-if': 'error',
      'no-loop-func': 'error',
      'no-multi-assign': 'error',
      'no-negated-condition': 'error',
      'no-nested-ternary': 'error',
      'no-new-wrappers': 'error',
      'no-param-reassign': 'error',
      'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-undef': 'off',
      'no-unexpected-multiline': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-useless-catch': 'error',
      'no-use-before-define': 'error',
      'prettier/prettier': 'error',
    },
  },
  {
    ignores: ['.eslintrc.js'], // Use "ignores" for files to be ignored
  },
];
