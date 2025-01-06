/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
    // preset: "ts-jest/presets/js-with-ts",
    // testEnvironment: "jest-environment-jsdom",
    moduleNameMapper: {
        "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": "<rootDir>/__mocks__/fileMock.js",
        "\\.(css|less)$": "<rootDir>/__mocks__/styleMock.js"
    },
    modulePaths: [
        // you can update this to match your application setup
        "<rootDir>/src"
    ],
    transform: {
        '^.+\\.[j|t]sx?$': ['ts-jest', { useESM: true }]
    },
    preset: 'ts-jest/presets/js-with-ts-esm',
    testEnvironment: 'node',
};