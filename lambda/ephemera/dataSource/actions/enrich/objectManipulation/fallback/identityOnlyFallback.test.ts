import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { InvokeBedrockObjectManipulationEnrichResult } from '../../../../../generateExample/invokeBedrockObjectManipulationEnrich'
import type { ObjectManipulationCatalogEntry } from '../catalogMerge'
import type { ParseSkeleton } from '../parse/parseToken'
import { planSkeleton } from '../plan/planSkeleton'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import { testLudicGraph } from '../../../../positions/ludicGraph/testFixtures'
import {
    invokeIdentityOnlyFallback,
    proposeIdentityOnlyFallbackTuples,
    type IdentityOnlyFallbackInput,
} from './identityOnlyFallback'

const bagId = 'OBJECT#Bag' as EphemeraObjectId
const broomId = 'OBJECT#Broom' as EphemeraObjectId
const satchelId = 'OBJECT#Satchel' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId

const catalog: ObjectManipulationCatalogEntry[] = [
    { objectId: bagId, normalizedShortName: 'bag', catalogScope: 'room' },
    { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
    { objectId: satchelId, normalizedShortName: 'satchel', catalogScope: 'held' },
]

const takeAttempt = (() => {
    const skeleton: ParseSkeleton = [
        { type: 'text', text: 'take' },
        { type: 'objectSpan', span: 'the bag', stableRefKey: 'bagRef' },
    ]
    const result = planSkeleton(skeleton, 'take the bag')
    return result.attempts[0]
})()

const baseInput: IdentityOnlyFallbackInput = {
    command: 'take the bag',
    rawObjectSpan: 'the bag',
    catalog,
    attempt: takeAttempt,
}

const successInvoke = (body: string) => async (): Promise<InvokeBedrockObjectManipulationEnrichResult> => ({
    success: true,
    body,
})

const errorInvoke = async (): Promise<InvokeBedrockObjectManipulationEnrichResult> => ({
    success: false,
    errorMessage: 'boom',
})

describe('identityOnlyFallback', () => {
    describe('invokeIdentityOnlyFallback', () => {
        it('maps a valid LLM response into IdentityPlanCandidates, dropping unknown ids', async () => {
            const body = JSON.stringify({
                candidates: [
                    { objectId: bagId, confidence: 0.9 },
                    { objectId: satchelId, confidence: 0.4 },
                    { objectId: 'OBJECT#Unknown', confidence: 0.5 },
                ],
            })
            const result = await invokeIdentityOnlyFallback(baseInput, {
                invokeBedrockObjectManipulationIdentityOnlyFallbackImpl: successInvoke(body),
            })
            expect(result).toEqual({
                type: 'success',
                candidates: [
                    {
                        identity: {
                            objectId: bagId,
                            label: 'bag',
                            locus: { kind: 'room' },
                            jointRelevance: 0.9,
                            sourceTags: ['llm'],
                        },
                        plan: takeAttempt,
                        confidence: 0.9,
                    },
                    {
                        identity: {
                            objectId: satchelId,
                            label: 'satchel',
                            locus: { kind: 'heldByActor' },
                            jointRelevance: 0.4,
                            sourceTags: ['llm'],
                        },
                        plan: takeAttempt,
                        confidence: 0.4,
                    },
                ],
            })
        })

        it('surfaces a distinct error when the Bedrock invoke itself fails', async () => {
            const result = await invokeIdentityOnlyFallback(baseInput, {
                invokeBedrockObjectManipulationIdentityOnlyFallbackImpl: errorInvoke,
            })
            expect(result).toEqual({
                type: 'error',
                errorMessage: objectManipulationErrorMessages.identityOnlyFallbackInvokeFailed,
            })
        })

        it('surfaces a distinct error when the response body does not parse', async () => {
            const result = await invokeIdentityOnlyFallback(baseInput, {
                invokeBedrockObjectManipulationIdentityOnlyFallbackImpl: successInvoke('not json'),
            })
            expect(result).toEqual({
                type: 'error',
                errorMessage: objectManipulationErrorMessages.identityOnlyFallbackParseFailed,
            })
        })
    })

    describe('proposeIdentityOnlyFallbackTuples', () => {
        it('returns [] when invoke fails', async () => {
            const candidates = await proposeIdentityOnlyFallbackTuples(baseInput, {
                invokeBedrockObjectManipulationIdentityOnlyFallbackImpl: errorInvoke,
            })
            expect(candidates).toEqual([])
        })
    })

})
