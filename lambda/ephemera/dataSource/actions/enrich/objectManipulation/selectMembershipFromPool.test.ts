import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { T_JOINT_ABS, T_JOINT_MARGIN } from './embeddingMatch/thresholds'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { selectMembershipFromPool } from './selectMembershipFromPool'
import type { SpanCandidatePool } from './spanResolution'
import { buildSandboxState } from './sandboxState'
import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'

const bagId = 'OBJECT#Bag' as EphemeraObjectId
const satchelId = 'OBJECT#Satchel' as EphemeraObjectId
const broomId = 'OBJECT#Broom' as EphemeraObjectId
const mopId = 'OBJECT#Mop' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId

const catalog: ObjectManipulationCatalogEntry[] = [
    { objectId: bagId, normalizedShortName: 'bag', catalogScope: 'room' },
    { objectId: satchelId, normalizedShortName: 'satchel', catalogScope: 'held' },
    { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
    { objectId: mopId, normalizedShortName: 'mop', catalogScope: 'room' },
]

const roomGraph = testLudicGraph(roomId, {
    nodes: [
        { tag: 'Object' as const, universalKey: bagId },
        { tag: 'Object' as const, universalKey: broomId },
        { tag: 'Object' as const, universalKey: mopId },
    ],
})
const characterGraph = testLudicGraph(characterId, {
    nodes: [{ tag: 'Object' as const, universalKey: satchelId }],
})
const sandboxState = buildSandboxState([roomGraph, characterGraph])

describe('selectMembershipFromPool', () => {
    it('illegal-if-wrong drop bag resolves held satchel', () => {
        const pool: SpanCandidatePool = {
            span: 'bag',
            candidates: [
                {
                    id: bagId,
                    label: 'bag',
                    jointRelevance: 0.72,
                    sourceTags: ['lexical', 'embedding'],
                    locus: { kind: 'room' },
                },
                {
                    id: satchelId,
                    label: 'satchel',
                    jointRelevance: 0.6,
                    sourceTags: ['lexical', 'embedding'],
                    locus: { kind: 'heldByActor' },
                },
            ],
        }

        expect(selectMembershipFromPool({
            spanPools: [pool],
            verbClass: 'release',
            catalog,
            sandboxState,
            roomId,
            actorCharacterId: characterId,
        })).toEqual({
            type: 'resolved',
            objectId: satchelId,
            objectIds: [satchelId],
            operationKind: 'drop',
            catalogScope: 'held',
        })
    })

    it('preserves thin-margin consult alternatives', () => {
        const pool: SpanCandidatePool = {
            span: 'sweeping tool',
            candidates: [
                {
                    id: broomId,
                    label: 'broom',
                    jointRelevance: T_JOINT_ABS + 0.05,
                    marginToRunnerUp: T_JOINT_MARGIN - 0.01,
                    sourceTags: ['lexical', 'embedding'],
                    locus: { kind: 'room' },
                },
                {
                    id: mopId,
                    label: 'mop',
                    jointRelevance: T_JOINT_ABS + 0.02,
                    sourceTags: ['lexical', 'embedding'],
                    locus: { kind: 'room' },
                },
            ],
        }

        expect(selectMembershipFromPool({
            spanPools: [pool],
            verbClass: 'acquire',
            catalog,
            sandboxState,
            roomId,
            actorCharacterId: characterId,
        })).toEqual({
            type: 'consult',
            alternatives: [
                {
                    objectId: broomId,
                    label: 'broom',
                    proposedCommand: 'take the broom',
                },
                {
                    objectId: mopId,
                    label: 'mop',
                    proposedCommand: 'take the mop',
                },
            ],
        })
    })

    // Slice 3's "carry-related object (glass On tray)" test is retired 2026-08-22 (Channel D,
    // CD2, reduced scope): it tested `On`'s carry absorption end to end, which is now dead --
    // `On` joined `In`/`PartOf`'s hosting-kind throw in `classifyInteractionUnderTransfer`, and
    // `carry` is unreachable from any relation kind. Real shard-based hosting (CD2h) is what
    // would eventually carry the glass along again.

    it('maps grey-band to abstain (not consult, not error)', () => {
        const pool: SpanCandidatePool = {
            span: 'sword',
            candidates: [
                {
                    id: broomId,
                    label: 'broom',
                    jointRelevance: T_JOINT_ABS - 0.1,
                    sourceTags: ['embedding'],
                    locus: { kind: 'room' },
                },
            ],
        }

        expect(selectMembershipFromPool({
            spanPools: [pool],
            verbClass: 'acquire',
            catalog,
            sandboxState,
            roomId,
            actorCharacterId: characterId,
        })).toEqual({
            type: 'abstain',
            reason: objectManipulationErrorMessages.noMatch,
        })
    })
})
