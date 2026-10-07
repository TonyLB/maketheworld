import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'
import { compileAttemptsFromSkeleton } from './compileAttemptsFromSkeleton'
import type { ParseSkeleton } from './parse/parseToken'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { planSkeleton } from './plan/planSkeleton'
import { CommandAttempt } from '../../commandAttempt'
import { peerRelationFixture } from './peerRelationFixture'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const benchAId = 'OBJECT#BenchA' as EphemeraObjectId
const benchBId = 'OBJECT#BenchB' as EphemeraObjectId
const lampId = 'OBJECT#Lamp' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

const relationalSkeleton = (
    verb: string,
    subjectSpan: string,
    subjectKey: string,
    prep: string,
    targetSpan: string,
    targetKey: string
): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span: subjectSpan, stableRefKey: subjectKey },
    { type: 'text', text: prep },
    { type: 'objectSpan', span: targetSpan, stableRefKey: targetKey },
]

/** Plan's primary attempt for a skeleton: the input the producers take (ISS8203 slice 1). */
const planned = (skeleton: ParseSkeleton) => {
    const plan = planSkeleton(skeleton, 'test command')
    if (plan.type !== 'attempts' || plan.attempts.length === 0) {
        throw new Error('planSkeleton produced no attempt for this skeleton')
    }
    return plan.attempts[0]
}

/** The attempt's relation step: Plan's relational template puts it in the one position action. */
const relationStepOf = (result: { type: string; attempt?: unknown }): any => {
    const actions = (result.attempt as { actions: { desiredResult?: unknown }[] }).actions
    return actions[0]?.desiredResult
}

describe('compileAttemptsFromSkeleton (relational)', () => {
    it('returns EstablishRelation for a matched closed-template command with grounded catalog', async () => {
        const getLudicGraph = jest.fn().mockResolvedValue(
            testLudicGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: broomId },
                    { tag: 'Object' as const, universalKey: tableId },
                ],
            })
        )

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put broom under table',
                skeleton: relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'),
                attempts: [peerRelationFixture('put broom under table', relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'), { primitive: 'establishRelation', relationKind: 'Custom', relationLabel: 'under' })],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: broomId, normalizedShortName: 'broom' },
                    { objectId: tableId, normalizedShortName: 'table' },
                ],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn().mockResolvedValue([roomId]), getLudicGraph } }
        )

        expect(result).toEqual({
            type: 'CommandAttempt',
            confidence: 0.9,
            attempt: expect.objectContaining({
                words: 'put broom under table',
                // Parse's own stableRefKey, not a synthesized `${id}/subject` key.
                referents: [
                    { refKey: 'broomRef', id: broomId, shortName: 'broom' },
                    { refKey: 'tableRef', id: tableId, shortName: 'table' },
                ],
            }),
        })
        expect(relationStepOf(result)).toMatchObject({
            primitive: 'establishRelation',
            relationKind: 'Custom', relationLabel: 'under',
            subject: { groundedId: broomId },
            target: { groundedId: tableId },
        })
    })

    it('grounds "put bench under bench" to two distinct benches, not a self-relation (BD-23), and Consults over the symmetric pair (2d)', async () => {
        const getLudicGraph = jest.fn().mockResolvedValue(
            testLudicGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: benchAId },
                    { tag: 'Object' as const, universalKey: benchBId },
                ],
            })
        )

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put bench under bench',
                skeleton: relationalSkeleton('put', 'bench', 'benchRef1', 'under', 'bench', 'benchRef2'),
                attempts: [peerRelationFixture('put bench under bench', relationalSkeleton('put', 'bench', 'benchRef1', 'under', 'bench', 'benchRef2'), { primitive: 'establishRelation', relationKind: 'Custom', relationLabel: 'under' })],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: benchAId, normalizedShortName: 'bench' },
                    { objectId: benchBId, normalizedShortName: 'bench' },
                ],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn().mockResolvedValue([roomId]), getLudicGraph } }
        )

        // The producer excludes self-relation, leaving exactly the two
        // genuinely-distinct orderings (benchA under benchB, benchB under benchA) ---
        // not the four combinations a naive product would form. Their confidence ties
        // (both benches match the "bench" span identically), so `selectPlanTuple`'s thin
        // margin now asks instead of silently committing to one, where the old
        // `candidates[0]` placeholder would have picked an arbitrary ordering.
        expect(result.type).toBe('Consult')
        if (result.type === 'Consult') {
            expect(result.alternatives).toHaveLength(2)
            for (const alternative of result.alternatives) {
                expect(alternative.proposedCommand).toBe('put the bench under the bench')
            }
        }
    })

    it('returns noHostRoom Error when hostRoomId is absent', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put broom under table',
                skeleton: relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'),
                attempts: [peerRelationFixture('put broom under table', relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'), { primitive: 'establishRelation', relationKind: 'Custom', relationLabel: 'under' })],
                characterId,
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noHostRoom,
        })
    })

    it('returns noHostRoom Error when characterId is absent', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put broom under table',
                skeleton: relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'),
                attempts: [peerRelationFixture('put broom under table', relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'), { primitive: 'establishRelation', relationKind: 'Custom', relationLabel: 'under' })],
                hostRoomId: roomId,
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noHostRoom,
        })
    })

    it('abstains when the only grounded candidate is a self-relation', async () => {
        const getLudicGraph = jest.fn().mockResolvedValue(
            testLudicGraph(roomId, {
                nodes: [{ tag: 'Object' as const, universalKey: lampId }],
            })
        )

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put lamp under lamp',
                skeleton: relationalSkeleton('put', 'lamp', 'lampRef1', 'under', 'lamp', 'lampRef2'),
                attempts: [peerRelationFixture('put lamp under lamp', relationalSkeleton('put', 'lamp', 'lampRef1', 'under', 'lamp', 'lampRef2'), { primitive: 'establishRelation', relationKind: 'Custom', relationLabel: 'under' })],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: lampId, normalizedShortName: 'lamp' }],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn().mockResolvedValue([roomId]), getLudicGraph } }
        )

        expect(result.type).toBe('Abstain')
        expect((result as { confidence: number }).confidence).toBe(0.9)
    })

    it('drops a self-relation of a hosting kind at the producer (no self-relations)', async () => {
        const getLudicGraph = jest.fn().mockResolvedValue(
            testLudicGraph(roomId, {
                nodes: [{ tag: 'Object' as const, universalKey: lampId }],
            })
        )

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put lamp around lamp',
                skeleton: relationalSkeleton('put', 'lamp', 'lampRef1', 'around', 'lamp', 'lampRef2'),
                attempts: [peerRelationFixture('put lamp around lamp', relationalSkeleton('put', 'lamp', 'lampRef1', 'around', 'lamp', 'lampRef2'), { primitive: 'establishRelation', relationKind: 'Custom', relationLabel: 'around' })],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: lampId, normalizedShortName: 'lamp' }],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn().mockResolvedValue([roomId]), getLudicGraph } }
        )

        expect(result).toEqual({
            type: 'Abstain',
            confidence: 0.9,
            reason: 'No combination of two distinct grounded objects produced a well-typed establishRelation/dissolveRelation step',
        })
    })

    it('abstains when a span resolves to no catalog candidates', async () => {
        const getLudicGraph = jest.fn().mockResolvedValue(
            testLudicGraph(roomId, {
                nodes: [{ tag: 'Object' as const, universalKey: tableId }],
            })
        )

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put sword under table',
                skeleton: relationalSkeleton('put', 'sword', 'swordRef', 'under', 'table', 'tableRef'),
                attempts: [peerRelationFixture('put sword under table', relationalSkeleton('put', 'sword', 'swordRef', 'under', 'table', 'tableRef'), { primitive: 'establishRelation', relationKind: 'Custom', relationLabel: 'under' })],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: tableId, normalizedShortName: 'table' }],
            },
            0.9,
            {
                positionsReadDeps: { getMembershipContainers: jest.fn().mockResolvedValue([roomId]), getLudicGraph },
                embedSpan: jest.fn().mockResolvedValue({ success: true, embedding: [0.01, 0.02, 0.03] }),
            }
        )

        expect(result.type).toBe('Abstain')
    })

    it('abstains on a Custom-relation candidate whose subject/object hosts differ (sameHost defer, no complexity LLM on this route)', async () => {
        const charmId = 'OBJECT#Charm' as EphemeraObjectId
        const necklaceId = 'OBJECT#Necklace' as EphemeraObjectId
        const roomGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Object' as const, universalKey: charmId }],
        })
        const heldGraph = testLudicGraph(characterId, {
            nodes: [{ tag: 'Object' as const, universalKey: necklaceId }],
        })
        const getLudicGraph = jest.fn().mockImplementation(async (hostId: string) => (
            hostId === characterId ? heldGraph : roomGraph
        ))
        // Genuinely disjoint shards, not just "the character happens not to be asked about" ---
        // This fixture's old blanket `[roomId]` default also answered
        // "what contains the acting character" as the room, which (once the port-address guard
        // that used to drop every crossing regardless was lifted) resolves a real crossing
        // through the character's own room membership rather than deferring. Explicit `[]` for
        // the character keeps this fixture's actual intent (no path from necklace to charm at
        // all) rather than relying on an unmodeled id happening to fall through to a shared host.
        const getMembershipContainers = jest.fn().mockImplementation(async (objectId: string) => {
            if (objectId === necklaceId) return [characterId]
            if (objectId === charmId) return [roomId]
            return []
        })

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'wrap charm around necklace',
                skeleton: relationalSkeleton('put', 'charm', 'charmRef', 'around', 'necklace', 'necklaceRef'),
                attempts: [peerRelationFixture('wrap charm around necklace', relationalSkeleton('put', 'charm', 'charmRef', 'around', 'necklace', 'necklaceRef'), { primitive: 'establishRelation', relationKind: 'Custom', relationLabel: 'around' })],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: charmId, normalizedShortName: 'charm' }],
                heldInventoryCatalog: [{ objectId: necklaceId, normalizedShortName: 'necklace' }],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers, getLudicGraph } }
        )

        expect(result.type).toBe('Abstain')
    })

    it('crosses the shard boundary live: tying to a cup nested two hosts deep produces a port and two legs', async () => {
        // rope/string sits directly in the room; cup sits on the table, which sits in the room.
        // The pre-fetch is deepened so `findShardBoundary` can reach the room as a common
        // ancestor past the table, and the route carries the full outcome (port + both legs)
        // into the widened result instead of taking only the first
        // establishRelation/dissolveRelation step and rejecting
        // its port-address endpoint. Matches the readout: room holds `string -> port`, table
        // holds the crossing port and `port -> cup`.
        const stringId = 'OBJECT#String' as EphemeraObjectId
        const cupId = 'OBJECT#Cup' as EphemeraObjectId
        const roomGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Object' as const, universalKey: stringId }],
        })
        const tableGraph = testLudicGraph(tableId, {
            nodes: [{ tag: 'Object' as const, universalKey: cupId }],
        })
        const getLudicGraph = jest.fn().mockImplementation(async (hostId: string) => (
            hostId === tableId ? tableGraph : roomGraph
        ))
        const getMembershipContainers = jest.fn().mockImplementation(async (objectId: string) => {
            if (objectId === cupId) return [tableId]
            if (objectId === tableId) return [roomId]
            return [roomId]
        })

        const result = await compileAttemptsFromSkeleton(
            {
                command: 'tie string to cup',
                skeleton: relationalSkeleton('tie', 'string', 'stringRef', 'to', 'cup', 'cupRef'),
                attempts: [peerRelationFixture('tie string to cup', relationalSkeleton('tie', 'string', 'stringRef', 'to', 'cup', 'cupRef'), { primitive: 'establishRelation', relationKind: 'Custom', relationLabel: 'to' })],
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: stringId, normalizedShortName: 'string' },
                    { objectId: cupId, normalizedShortName: 'cup' },
                ],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers, getLudicGraph } }
        )

        expect(getMembershipContainers).toHaveBeenCalledWith(tableId)
        expect(result.type).toBe('CommandAttempt')
        expect(relationStepOf(result)).toMatchObject({
            primitive: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'to',
            subject: { groundedId: stringId },
            target: { groundedId: cupId },
        })
        // The crossing's port and legs are lowered from the chain by commit, and their order is
        // covered by `synthesize/buildCrossingLegs.test.ts`; the attempt carries only the relation.

    })
})
