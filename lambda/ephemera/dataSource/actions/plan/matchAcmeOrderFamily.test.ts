import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ParseCommandInput } from '../baseClasses'
import { matchAcmeOrderFamily } from './matchAcmeOrderFamily'

const underCapCountDeps = {
    getGameRooms: async () => ['U'],
    getObjectIdsInRoom: async () => [] as EphemeraObjectId[],
}

const baseInput: ParseCommandInput = { command: 'order rope', occupiedStableKeys: ['existing-key'] }

describe('matchAcmeOrderFamily', () => {
    it('matches the order verb on the first word and calls enrichAcmeOrder with the command', async () => {
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: `\`\`\`json
{
  "lines": [
    { "valid": true, "name": "rope", "stableKey": "rope", "tropeAffinities": [{ "trope": "Contraption", "aptness": "Good", "narrowing": "rope rig" }] }
  ],
  "confidence": 0.9
}
\`\`\``,
        })

        const result = await matchAcmeOrderFamily(baseInput, 0.8, {
            invokeBedrockAcmeOrderEnrichImpl,
            countCoyotePlacedObjectsAcrossRoomsDeps: underCapCountDeps,
        })

        expect(result).toEqual({
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
        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalled()
    })

    it('recognizes buy/purchase as well as order', async () => {
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({ success: false })
        for (const verb of ['buy', 'purchase']) {
            const result = await matchAcmeOrderFamily({ ...baseInput, command: `${verb} rope` }, 0.8, {
                invokeBedrockAcmeOrderEnrichImpl,
                countCoyotePlacedObjectsAcrossRoomsDeps: underCapCountDeps,
            })
            expect(result).not.toBeNull()
        }
    })

    it('returns null when the first word is not an order verb', async () => {
        expect(await matchAcmeOrderFamily({ ...baseInput, command: 'take rope' }, 0.8)).toBeNull()
        expect(await matchAcmeOrderFamily({ ...baseInput, command: 'reorder rope' }, 0.8)).toBeNull()
    })

    it('returns null when nothing follows the verb', async () => {
        expect(await matchAcmeOrderFamily({ ...baseInput, command: 'order' }, 0.8)).toBeNull()
        expect(await matchAcmeOrderFamily({ ...baseInput, command: 'order!' }, 0.8)).toBeNull()
    })

    it('returns null when the command is empty', async () => {
        expect(await matchAcmeOrderFamily({ ...baseInput, command: '' }, 0.8)).toBeNull()
    })

    it('hands the model the whole command, with no order list, so it splits the orders', async () => {
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({ success: false })
        await matchAcmeOrderFamily({ ...baseInput, command: 'Order rope and a bucket' }, 0.8, {
            invokeBedrockAcmeOrderEnrichImpl,
            countCoyotePlacedObjectsAcrossRoomsDeps: underCapCountDeps,
        })
        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalledTimes(1)
        expect(invokeBedrockAcmeOrderEnrichImpl.mock.calls[0][0].dynamicSuffix).not.toContain('## Product spans to validate')
    })
})
