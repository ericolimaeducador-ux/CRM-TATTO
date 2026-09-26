/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 120000,
  maxWorkers: 1,
  passWithNoTests: true,
  clearMocks: true,
};
