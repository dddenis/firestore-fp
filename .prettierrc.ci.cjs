const config = require('./.prettierrc.cjs');

module.exports = {
  ...config,
  plugins: [require.resolve('prettier-plugin-organize-imports')],
};
