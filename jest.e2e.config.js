/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/e2e/global-setup.js',
  globalTeardown: '<rootDir>/e2e/global-teardown.js',
  testMatch: ['<rootDir>/__tests__/e2e/**/*.test.ts'],
  testTimeout: 30000,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
  },
}

module.exports = config
