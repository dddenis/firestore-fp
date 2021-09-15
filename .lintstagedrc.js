const { ESLint } = require('eslint');

module.exports = {
  '*.{js,ts,tsx}': async (files) => lintFiles(await removeIgnoredFiles(files)),
  '*.{js,json,md,ts,tsx,yml,yaml}': formatFiles,
};

const eslint = new ESLint();

async function removeIgnoredFiles(files) {
  const filteredFiles = await Promise.all(
    files.map(async (file) => ((await eslint.isPathIgnored(file)) ? null : file)),
  );

  return filteredFiles.filter(Boolean);
}

function lintFiles(files) {
  return `yarn lint:base --fix ${files.join(' ')}`;
}

function formatFiles(files) {
  return `yarn format:base ${files.join(' ')}`;
}
