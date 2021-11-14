module.exports = {
  extends: './.eslintrc.cjs',

  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./example/tsconfig.json', 'tsconfig.json', 'tsconfig.eslint.json'],
      },
      extends: ['plugin:@typescript-eslint/recommended-requiring-type-checking'],
      rules: {
        '@typescript-eslint/no-unused-vars': [1, { argsIgnorePattern: '^_' }],
        '@typescript-eslint/unbound-method': [2, { ignoreStatic: true }],
      },
    },
  ],
};
