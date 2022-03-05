import { jest } from '@jest/globals'

export const validateJWT = jest.fn(async () => {
    return { userName: 'Test' }
})
