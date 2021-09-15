const config = require('./.prettierrc.js');

module.exports = {
  ...config,
  plugins: [require.resolve('prettier-plugin-organize-imports')],
};
