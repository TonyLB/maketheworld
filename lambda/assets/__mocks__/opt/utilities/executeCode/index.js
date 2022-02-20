import { jest } from '@jest/globals'

const mockExecute = jest.fn().mockResolvedValue('')

export const recalculateComputes = jest.fn()
export const executeInAsset = jest.fn().mockReturnValue(mockExecute)
