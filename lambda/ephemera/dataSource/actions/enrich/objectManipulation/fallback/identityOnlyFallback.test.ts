import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { InvokeBedrockObjectManipulationEnrichResult } from '../../../../../generateExample/invokeBedrockObjectManipulationEnrich'
import type { ObjectManipulationCatalogEntry } from '../catalogMerge'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import { buildSandboxState } from '../sandboxState'
import { testPositionGraph } from '../../../../positions/ludicGraph/testFixtures'
import {
    invokeIdentityOnlyFallback,
    proposeIdentityOnlyFallbackTuples,
    selectIdentityOnlyFallbackTuple,
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

const baseInput: IdentityOnlyFallbackInput = {
    command: 'take the bag',
    rawObjectSpan: 'the bag',
    catalog,
    operationKind: 'takeHold',
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
                        plan: { kind: 'transferMembership', operationKind: 'takeHold' },
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
                        plan: { kind: 'transferMembership', operationKind: 'takeHold' },
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

    describe('selectIdentityOnlyFallbackTuple', () => {
        it('surfaces the empty-candidates error when the fallback declines', async () => {
            const result = await selectIdentityOnlyFallbackTuple(baseInput, {}, {
                invokeBedrockObjectManipulationIdentityOnlyFallbackImpl: errorInvoke,
            })
            expect(result).toEqual({
                verdict: 'error',
                reason: objectManipulationErrorMessages.noCatalog,
            })
        })

        it('resolves a real LLM-proposed candidate through the shared sandbox dry run', async () => {
            const roomGraph = testPositionGraph(roomId, {
                nodes: [{ tag: 'Object' as const, universalKey: bagId }],
            })
            const characterGraph = testPositionGraph(characterId, { nodes: [] })
            const sandboxState = buildSandboxState([roomGraph, characterGraph])
            const body = JSON.stringify({ candidates: [{ objectId: bagId, confidence: 0.95 }] })

            const result = await selectIdentityOnlyFallbackTuple(
                baseInput,
                { sandboxState, roomId, actorCharacterId: characterId },
                { invokeBedrockObjectManipulationIdentityOnlyFallbackImpl: successInvoke(body) }
            )

            expect(result.verdict).toBe('resolved')
            if (result.verdict === 'resolved') {
                expect(result.candidate.identity.objectId).toBe(bagId)
            }
        })
    })
})
