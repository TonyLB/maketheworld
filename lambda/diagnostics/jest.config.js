/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
  globals: {
      extensionsToTreatAsEsm: ['.ts', '.js'],
      'ts-jest': {
          useESM: true,
          isolatedModules: true
      }
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }]
  },
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
};
