import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ACME_ORDER_TOO_MANY_PLACED_OBJECTS_MESSAGE, enrichAcmeOrder } from './index'

const emptyCoyoteRoomMeta = (roomKey: string): EphemeraMetaRoom => ({
    EphemeraId: `ROOM#${roomKey}` as `ROOM#${string}`,
    DataCategory: 'Meta::Room',
    objects: [],
})

const underCapCountDeps = {
    getGameRooms: async () => ['U'],
    getRoomMeta: async (roomId: `ROOM#${string}`) =>
        (roomId === 'ROOM#U' ? emptyCoyoteRoomMeta('U') : undefined),
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
      "affinities": [{ "role": "delivery", "aptness": 0.6 }]
    }
  ],
  "confidence": 0.9
}
\`\`\``,
        })

        const output = await enrichAcmeOrder(
            { command: 'order rope', occupiedStableKeys: ['existing-key'] },
            0.8,
            invokeBedrockAcmeOrderEnrichImpl,
            underCapCountDeps
        )

        expect(output.result).toEqual({
            type: 'AcmeOrder',
            orders: [{
                valid: true,
                name: 'rope',
                stableKey: 'rope',
                affinities: [{ role: 'delivery', aptness: 0.6 }],
            }],
            confidence: 0.8 * 0.9,
        })
        expect(output.enrichReasoningMarkdown).toContain('Notes')
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
            invokeBedrockAcmeOrderEnrichImpl,
            underCapCountDeps
        )

        expect(output.result).toEqual({
            type: 'AcmeOrder',
            orders: [{
                valid: true,
                name: 'order anvil from acme',
                stableKey: 'order-anvil-from-acme',
                affinities: [],
                affinitiesFailed: true,
            }],
            confidence: 0.75,
        })
        expect(output.enrichReasoningMarkdown).toBe('')
    })

    it('returns Error and does not invoke enrich when placement count exceeds cap', async () => {
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{}',
        })
        const objects = Array.from({ length: 21 }, (_, i) => ({
            uuid: `OBJECT#${i}` as `OBJECT#${string}`,
            shortName: 'x',
            stableKey: 'k',
        }))
        const output = await enrichAcmeOrder(
            { command: 'order rope' },
            0.8,
            invokeBedrockAcmeOrderEnrichImpl,
            {
                getGameRooms: async () => ['Over'],
                getRoomMeta: async (roomId) =>
                    (roomId === 'ROOM#Over'
                        ? {
                            ...emptyCoyoteRoomMeta('Over'),
                            objects,
                        }
                        : undefined),
            }
        )

        expect(invokeBedrockAcmeOrderEnrichImpl).not.toHaveBeenCalled()
        expect(output.result).toEqual({
            type: 'Error',
            errorMessage: ACME_ORDER_TOO_MANY_PLACED_OBJECTS_MESSAGE,
        })
        expect(output.enrichReasoningMarkdown).toBe('')
    })

    it('still invokes enrich when placement count is exactly at cap', async () => {
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: JSON.stringify({
                lines: [{
                    valid: true,
                    name: 'rope',
                    stableKey: 'rope',
                    affinities: [],
                }],
                confidence: 1,
            }),
        })
        const objects = Array.from({ length: 20 }, (_, i) => ({
            uuid: `OBJECT#${i}` as `OBJECT#${string}`,
            shortName: 'x',
            stableKey: 'k',
        }))
        const output = await enrichAcmeOrder(
            { command: 'order rope' },
            0.5,
            invokeBedrockAcmeOrderEnrichImpl,
            {
                getGameRooms: async () => ['Edge'],
                getRoomMeta: async (roomId) =>
                    (roomId === 'ROOM#Edge'
                        ? {
                            ...emptyCoyoteRoomMeta('Edge'),
                            objects,
                        }
                        : undefined),
            }
        )

        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalledTimes(1)
        expect(output.result).toEqual({
            type: 'AcmeOrder',
            orders: [{
                valid: true,
                name: 'rope',
                stableKey: 'rope',
                affinities: [],
            }],
            confidence: 0.5,
        })
    })
})
