import { jest } from '@jest/globals'

const mockSend = jest.fn().mockResolvedValue({})

export const s3Client = {
    send: mockSend
}

export class GetObjectCommand {
    constructor() {}
}
