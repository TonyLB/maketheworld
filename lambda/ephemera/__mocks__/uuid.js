const { v4: realV4 } = jest.requireActual('uuid')

/** Default delegates to real v4 so modules work without per-test setup; tests can still mockReturnValue / mockImplementation. */
export const v4 = jest.fn((...args) => realV4(...args))
