import type { SingleFlightParams } from '@tonylb/mtw-lambda-patterns/ts/singleFlight'
import { computeRenderGenerationArgumentHash } from './renderGenerationArgumentHash'
import { passThroughSingleFlight } from './singleFlightRenderGeneration'

describe('singleFlightRenderGeneration', () => {
    it('passThroughSingleFlight runs computation only (no retrieval)', async () => {
        const computation = jest.fn().mockResolvedValue(42)
        const retrieval = jest.fn().mockResolvedValue(99)
        const params: SingleFlightParams<number> = {
            category: 'test-cat',
            argumentHash: 'hash',
            computation,
            retrieval,
        }
        const result = await passThroughSingleFlight(params)
        expect(result).toBe(42)
        expect(computation).toHaveBeenCalledTimes(1)
        expect(retrieval).not.toHaveBeenCalled()
    })
})

describe('computeRenderGenerationArgumentHash', () => {
    it('is stable under mark order', () => {
        const roomId = 'ROOM#x' as const
        const pk = 'PERSPECTIVE#v1#abc'
        const a = computeRenderGenerationArgumentHash(roomId, pk, {
            markValue: [
                { mark: 'M2', value: 'b' },
                { mark: 'M1', value: 'a' },
            ],
        })
        const b = computeRenderGenerationArgumentHash(roomId, pk, {
            markValue: [
                { mark: 'M1', value: 'a' },
                { mark: 'M2', value: 'b' },
            ],
        })
        expect(a).toBe(b)
    })
})
