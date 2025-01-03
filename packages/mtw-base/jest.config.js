/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
  globals: {
      extensionsToTreatAsEsm: ['.ts', '.js']
  },
  transform: {
    // '^.+\\.[tj]sx?$' to process js/ts with `ts-jest`
    // '^.+\\.m?[tj]sx?$' to process js/ts/mjs/mts with `ts-jest`
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true
      },
    ],
  },  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
};