module.exports = {
  root: true,
  extends: ['eslint:recommended', 'prettier'],

  overrides: [
    {
      files: ['*.cjs', '*.js'],
      env: {
        node: true,
      },
    },
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {
        '@typescript-eslint/ban-types': [
          2,
          {
            extendDefaults: true,
            types: {
              object: false,
            },
          },
        ],
        '@typescript-eslint/explicit-function-return-type': [1, { allowExpressions: true }],
        '@typescript-eslint/no-unused-vars': [0],
        '@typescript-eslint/no-use-before-define': [2, { functions: false }],
      },
    },
  ],
};
