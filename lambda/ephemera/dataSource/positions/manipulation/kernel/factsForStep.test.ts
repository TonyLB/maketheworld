import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { factsForStep } from './factsForStep'
import type { MutationKernelStep } from './kernelStep'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId
const beatAnchorTime = 1_700_000_000_000

const graphsMap = (
    ...entries: [EphemeraMembershipHostId, EphemeraLudicGraph][]
): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => new Map(entries)

describe('factsForStep', () => {
    it('transferMembership with object-only entityIds produces one Object Moved fact per object', () => {
        const step: MutationKernelStep = {
            kind: 'transferMembership',
            entityIds: new Set([trayId, glassId]),
            fromHostIds: new Set([roomId]),
            toHostId: characterId,
        }
        const facts = factsForStep(step, graphsMap(), beatAnchorTime)
        expect(facts).toEqual([
            { type: 'Object Moved', objectId: trayId, froms: [roomId], to: characterId, beatAnchorTime },
            { type: 'Object Moved', objectId: glassId, froms: [roomId], to: characterId, beatAnchorTime },
        ])
    })

    it('a character in entityIds produces both an Object Moved and a Character Moved fact (folded in, character-route Migrate row)', () => {
        const step: MutationKernelStep = {
            kind: 'transferMembership',
            entityIds: new Set<EphemeraObjectId | EphemeraCharacterId>([trayId, characterId]),
            fromHostIds: new Set([roomId]),
            toHostId: roomId,
        }
        const facts = factsForStep(step, graphsMap(), beatAnchorTime)
        expect(facts).toEqual([
            { type: 'Object Moved', objectId: trayId, froms: [roomId], to: roomId, beatAnchorTime },
            { type: 'Character Moved', characterId, froms: [roomId], to: roomId, beatAnchorTime },
        ])
    })

    it('characterNames resolves the Character Moved fact\'s characterName; unresolved leaves it omitted', () => {
        const step: MutationKernelStep = {
            kind: 'transferMembership',
            entityIds: new Set([characterId]),
            fromHostIds: new Set([roomId]),
            toHostId: roomId,
        }
        const withName = factsForStep(step, graphsMap(), beatAnchorTime, undefined, new Map([[characterId, 'Alpha']]))
        expect(withName).toEqual([
            { type: 'Character Moved', characterId, froms: [roomId], to: roomId, beatAnchorTime, characterName: 'Alpha' },
        ])

        const withoutName = factsForStep(step, graphsMap(), beatAnchorTime)
        expect(withoutName).toEqual([
            { type: 'Character Moved', characterId, froms: [roomId], to: roomId, beatAnchorTime },
        ])
    })

    it('establishRelation produces one Object Relation Changed fact, host re-derived from finalGraphs', () => {
        const finalGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: glassId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: glassId, kind: 'On' }],
        })
        const step: MutationKernelStep = { kind: 'establishRelation', subjectId: trayId, targetId: glassId, relationKind: 'On' }
        const facts = factsForStep(step, graphsMap([roomId, finalGraph]), beatAnchorTime)
        expect(facts).toEqual([
            {
                type: 'Object Relation Changed',
                subjectId: trayId,
                targetId: glassId,
                hostId: roomId,
                relationKind: 'On',
                operation: 'establish',
                beatAnchorTime,
            },
        ])
    })

    it('dissolveRelation maps operation to dissolve', () => {
        const finalGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
        })
        const step: MutationKernelStep = { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, relationKind: 'On' }
        const facts = factsForStep(step, graphsMap([roomId, finalGraph]), beatAnchorTime)
        expect(facts).toEqual([
            {
                type: 'Object Relation Changed',
                subjectId: trayId,
                targetId: tableId,
                hostId: roomId,
                relationKind: 'On',
                operation: 'dissolve',
                beatAnchorTime,
            },
        ])
    })

    it('a multi-step array processed via flatMap preserves output order (dissolve-before-move)', () => {
        const finalSourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: tableId }] })
        const finalDestGraph = testLudicGraph(characterId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: glassId },
            ],
        })
        const steps: MutationKernelStep[] = [
            { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, relationKind: 'On' },
            { kind: 'transferMembership', entityIds: new Set([trayId, glassId]), fromHostIds: new Set([roomId]), toHostId: characterId },
        ]
        const finalGraphs = graphsMap([roomId, finalSourceGraph], [characterId, finalDestGraph])
        const facts = steps.flatMap((step) => factsForStep(step, finalGraphs, beatAnchorTime))
        expect(facts.map((fact) => fact.type)).toEqual(['Object Relation Changed', 'Object Moved', 'Object Moved'])
    })

    it('pure remove (toHostId null): one Object Moved fact per object with froms from every departure host, to: null', () => {
        const step: MutationKernelStep = {
            kind: 'transferMembership',
            entityIds: new Set([trayId]),
            fromHostIds: new Set([roomId, characterId]),
            toHostId: null,
        }
        const facts = factsForStep(step, graphsMap(), beatAnchorTime)
        expect(facts).toEqual([
            { type: 'Object Moved', objectId: trayId, froms: [roomId, characterId], to: null, beatAnchorTime },
        ])
    })

    it('dissolveRelation falls back to priorGraphs when the subject was removed entirely (destroy sequence)', () => {
        const finalGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: tableId }] })
        const priorGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
        })
        const step: MutationKernelStep = { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, relationKind: 'On' }
        const facts = factsForStep(step, graphsMap([roomId, finalGraph]), beatAnchorTime, graphsMap([roomId, priorGraph]))
        expect(facts).toEqual([
            {
                type: 'Object Relation Changed',
                subjectId: trayId,
                targetId: tableId,
                hostId: roomId,
                relationKind: 'On',
                operation: 'dissolve',
                beatAnchorTime,
            },
        ])
    })

    it('pure add (fromHostIds empty): one Object Moved fact per object with froms: [], to: toHostId', () => {
        const step: MutationKernelStep = {
            kind: 'transferMembership',
            entityIds: new Set([trayId]),
            fromHostIds: new Set(),
            toHostId: roomId,
        }
        const facts = factsForStep(step, graphsMap(), beatAnchorTime)
        expect(facts).toEqual([
            { type: 'Object Moved', objectId: trayId, froms: [], to: roomId, beatAnchorTime },
        ])
    })

    it('a capture step yields no facts --- it is not a world event (PB-J)', () => {
        const step: MutationKernelStep = { kind: 'capture', hostId: roomId, captureId: 'before' }
        expect(factsForStep(step, graphsMap(), beatAnchorTime)).toEqual([])
    })
})
