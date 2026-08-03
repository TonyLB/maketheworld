import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ACME_ORDER_TOO_MANY_PLACED_OBJECTS_MESSAGE, enrichAcmeOrder } from './index'

const underCapCountDeps = {
    getGameRooms: async () => ['U'],
    getObjectIdsInRoom: async () => [] as EphemeraObjectId[],
}

describe('enrichAcmeOrder', () => {
    it('returns merged AcmeOrder and reasoning when enrich invoke succeeds', async () => {
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: `## Notes
Check catalog.

\`\`\`json
{
  "lines": [
    {
      "valid": true,
      "name": "rope",
      "stableKey": "rope",
      "tropeAffinities": [{ "trope": "Contraption", "aptness": "Good", "narrowing": "rope rig" }]
    }
  ],
  "confidence": 0.9
}
\`\`\``,
        })

        const output = await enrichAcmeOrder(
            { command: 'order rope', occupiedStableKeys: ['existing-key'] },
            0.8,
            {
                invokeBedrockAcmeOrderEnrichImpl,
                countCoyotePlacedObjectsAcrossRoomsDeps: underCapCountDeps,
            }
        )

        expect(output.result).toEqual({
            type: 'AcmeOrder',
            orders: [{
                valid: true,
                name: 'rope',
                stableKey: 'rope',
                tropeAffinities: [{ trope: 'Contraption', aptness: 'Good', narrowing: 'rope rig' }],
                tropeAffinitiesFailed: false,
                defaultSituationFailed: true,
            }],
            confidence: 0.8 * 0.9,
        })
        expect(output.enrichReasoningMarkdown).toContain('Notes')
        expect(output.enrichRawBody).toContain('"lines"')
        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalledTimes(1)
        const parts = invokeBedrockAcmeOrderEnrichImpl.mock.calls[0]?.[0] as { dynamicSuffix: string }
        expect(parts.dynamicSuffix).toContain('- existing-key')
    })

    it('falls back to synthetic valid line when enrich invoke fails', async () => {
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: false,
            errorMessage: 'timeout',
        })

        const output = await enrichAcmeOrder(
            { command: 'order anvil from acme' },
            0.75,
            {
                invokeBedrockAcmeOrderEnrichImpl,
                countCoyotePlacedObjectsAcrossRoomsDeps: underCapCountDeps,
            }
        )

        expect(output.result).toEqual({
            type: 'AcmeOrder',
            orders: [{
                valid: true,
                name: 'order anvil from acme',
                stableKey: 'order-anvil-from-acme',
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
                defaultSituationFailed: true,
            }],
            confidence: 0.75,
        })
        expect(output.enrichReasoningMarkdown).toBe('')
        expect(output.enrichRawBody).toBeUndefined()
    })

    it('returns Error and does not invoke enrich when placement count exceeds cap', async () => {
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{}',
        })
        const objects = Array.from({ length: 21 }, (_, i) => `OBJECT#${i}` as EphemeraObjectId)
        const output = await enrichAcmeOrder(
            { command: 'order rope' },
            0.8,
            {
                invokeBedrockAcmeOrderEnrichImpl,
                countCoyotePlacedObjectsAcrossRoomsDeps: {
                    getGameRooms: async () => ['Over'],
                    getObjectIdsInRoom: async (roomId) => (roomId === 'ROOM#Over' ? objects : []),
                },
            }
        )

        expect(invokeBedrockAcmeOrderEnrichImpl).not.toHaveBeenCalled()
        expect(output.result).toEqual({
            type: 'Error',
            errorMessage: ACME_ORDER_TOO_MANY_PLACED_OBJECTS_MESSAGE,
        })
        expect(output.enrichReasoningMarkdown).toBe('')
        expect(output.enrichRawBody).toBeUndefined()
    })

    it('still invokes enrich when placement count is exactly at cap', async () => {
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: JSON.stringify({
                lines: [{
                    valid: true,
                    name: 'rope',
                    stableKey: 'rope',
                }],
                confidence: 1,
            }),
        })
        const objects = Array.from({ length: 20 }, (_, i) => `OBJECT#${i}` as EphemeraObjectId)
        const output = await enrichAcmeOrder(
            { command: 'order rope' },
            0.5,
            {
                invokeBedrockAcmeOrderEnrichImpl,
                countCoyotePlacedObjectsAcrossRoomsDeps: {
                    getGameRooms: async () => ['Edge'],
                    getObjectIdsInRoom: async (roomId) => (roomId === 'ROOM#Edge' ? objects : []),
                },
            }
        )

        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalledTimes(1)
        expect(output.result).toEqual({
            type: 'AcmeOrder',
            orders: [{
                valid: true,
                name: 'rope',
                stableKey: 'rope',
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
                defaultSituationFailed: true,
            }],
            confidence: 0.5,
        })
    })
})
