/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  globals: {
      extensionsToTreatAsEsm: ['.ts', '.js']
  },
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
        useESM: true,
        isolatedModules: true
    }]
  }
};