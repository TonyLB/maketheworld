/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
  globals: {
      extensionsToTreatAsEsm: ['.ts', '.js'],
      'ts-jest': {
          useESM: true,
          isolatedModules: true
      }
  },
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
};