import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ParseCommandInput } from '../baseClasses'
import type { ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import { matchAcmeOrderFamily } from './matchAcmeOrderFamily'

const underCapCountDeps = {
    getGameRooms: async () => ['U'],
    getObjectIdsInRoom: async () => [] as EphemeraObjectId[],
}

const orderRopeSkeleton: ParseSkeleton = [
    { type: 'text', text: 'order' },
    { type: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' },
]

const baseInput: ParseCommandInput = { command: 'order rope', occupiedStableKeys: ['existing-key'] }

describe('matchAcmeOrderFamily', () => {
    it('extracts rawOrders from the skeleton and calls enrichAcmeOrder', async () => {
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

        const result = await matchAcmeOrderFamily(orderRopeSkeleton, baseInput, 0.8, {
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
            const skeleton: ParseSkeleton = [
                { type: 'text', text: verb },
                { type: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' },
            ]
            const result = await matchAcmeOrderFamily(skeleton, baseInput, 0.8, {
                invokeBedrockAcmeOrderEnrichImpl,
                countCoyotePlacedObjectsAcrossRoomsDeps: underCapCountDeps,
            })
            expect(result).not.toBeNull()
        }
    })

    it('returns null when the leading token is not an order verb', async () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' },
        ]
        expect(await matchAcmeOrderFamily(skeleton, baseInput, 0.8)).toBeNull()
    })

    it('returns null when there are no object spans to extract', async () => {
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'order' }]
        expect(await matchAcmeOrderFamily(skeleton, baseInput, 0.8)).toBeNull()
    })

    it('returns null when the skeleton is empty', async () => {
        expect(await matchAcmeOrderFamily([], baseInput, 0.8)).toBeNull()
    })

    it('extracts multiple rawOrders, ignoring interstitial text tokens', async () => {
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({ success: false })
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'order' },
            { type: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' },
            { type: 'text', text: 'and' },
            { type: 'objectSpan', span: 'a bucket', stableRefKey: 'bucketRef' },
        ]
        await matchAcmeOrderFamily(skeleton, baseInput, 0.8, {
            invokeBedrockAcmeOrderEnrichImpl,
            countCoyotePlacedObjectsAcrossRoomsDeps: underCapCountDeps,
        })
        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalled()
    })
})
