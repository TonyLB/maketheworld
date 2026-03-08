import { generateRoomDescription } from './generateRoomDescription'

describe('generateRoomDescription (stub)', () => {
    it('returns NO_EXACT_MATCH for any input', async () => {
        const result = await generateRoomDescription({
            roomId: 'ROOM#test' as any,
            markState: { markValue: [] },
            perspective: { assetStack: [] },
            generationContext: null
        })
        expect(result).toEqual({
            success: false,
            errorCode: 'NO_EXACT_MATCH',
            errorMessage: 'No exact match for proposed state'
        })
    })
})
