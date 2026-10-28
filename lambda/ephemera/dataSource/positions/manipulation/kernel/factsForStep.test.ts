import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { factForRelationalEdge, factsForStep, isFactOfRelationalEdge, movedFactsFor } from './factsForStep'
import type { MembershipChange } from './membershipChanges'
import type { MutationKernelStep } from './kernelStep'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { parentRemainderKey } from '../../ludicGraph/testFixtures'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId
const beatAnchorTime = 1_700_000_000_000

const graphsMap = (
    ...entries: [EphemeraMembershipHostId, EphemeraLudicGraph][]
): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => new Map(entries)

describe('isFactOfRelationalEdge', () => {
    const kindOf = (kind: 'ConnectedTo' | 'Custom') => kind === 'Custom' ? { relationKind: 'Custom' as const, relationLabel: 'tied to' } : { relationKind: kind }
    const fact = (kind: 'ConnectedTo' | 'Custom', subjectId: EphemeraObjectId, targetId: EphemeraObjectId) => ({
        type: 'Object Relation Changed' as const, subjectId, targetId, hostId: roomId, operation: 'establish' as const, beatAnchorTime, ...kindOf(kind),
    })
    const edge = (kind: 'ConnectedTo' | 'Custom', subjectId: EphemeraObjectId, targetId: EphemeraObjectId) => ({
        subjectId, targetId, operation: 'establish' as const, ...kindOf(kind),
    })

    it('matches a ConnectedTo fact in either endpoint order', () => {
        expect(isFactOfRelationalEdge(fact('ConnectedTo', glassId, tableId), edge('ConnectedTo', tableId, glassId))).toBe(true)
    })

    it('stays directional for other kinds', () => {
        expect(isFactOfRelationalEdge(fact('Custom', glassId, tableId), edge('Custom', tableId, glassId))).toBe(false)
        expect(isFactOfRelationalEdge(fact('Custom', glassId, tableId), edge('Custom', glassId, tableId))).toBe(true)
    })
})

describe('factsForStep', () => {
    const change = (entityId: MembershipChange['entityId'], left: MembershipChange['left'], arrived: MembershipChange['arrived']): MembershipChange => ({ entityId, left, arrived, anchor: 0 })

    it('a membership change of an object produces one Object Moved fact', () => {
        expect(movedFactsFor(change(trayId, [roomId], [characterId]), beatAnchorTime)).toEqual([
            { type: 'Object Moved', objectId: trayId, froms: [roomId], to: characterId, beatAnchorTime },
        ])
    })

    it('a membership change of a character produces one Character Moved fact (folded in, character-route Migrate row)', () => {
        expect(movedFactsFor(change(characterId, [roomId], [otherRoomId]), beatAnchorTime)).toEqual([
            { type: 'Character Moved', characterId, froms: [roomId], to: otherRoomId, beatAnchorTime },
        ])
    })

    it('characterNames resolves the Character Moved fact\'s characterName; unresolved leaves it omitted', () => {
        const moved = change(characterId, [roomId], [otherRoomId])
        expect(movedFactsFor(moved, beatAnchorTime, new Map([[characterId, 'Alpha']]))).toEqual([
            { type: 'Character Moved', characterId, froms: [roomId], to: otherRoomId, beatAnchorTime, characterName: 'Alpha' },
        ])
        expect(movedFactsFor(moved, beatAnchorTime)).toEqual([
            { type: 'Character Moved', characterId, froms: [roomId], to: otherRoomId, beatAnchorTime },
        ])
    })

    it('a departure (no arrival): one Object Moved fact with froms from every host left, to: null', () => {
        expect(movedFactsFor(change(trayId, [roomId, characterId], []), beatAnchorTime)).toEqual([
            { type: 'Object Moved', objectId: trayId, froms: [roomId, characterId], to: null, beatAnchorTime },
        ])
    })

    it('a first arrival (nothing left): one Object Moved fact with froms: [], to: the host arrived at', () => {
        expect(movedFactsFor(change(trayId, [], [roomId]), beatAnchorTime)).toEqual([
            { type: 'Object Moved', objectId: trayId, froms: [], to: roomId, beatAnchorTime },
        ])
    })

    it('a Room or Feature moves no object or character: no moved fact', () => {
        expect(movedFactsFor(change('FEATURE#Fountain' as any, [], [roomId]), beatAnchorTime)).toEqual([])
    })

    it('establishRelation produces one Object Relation Changed fact, host re-derived from finalGraphs', () => {
        const finalGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: glassId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: glassId, kind: 'ConnectedTo' }],
        })
        const step: MutationKernelStep = { kind: 'establishRelation', subjectId: trayId, targetId: glassId, hostId: roomId, relationKind: 'ConnectedTo' }
        const facts = factsForStep(step, graphsMap([roomId, finalGraph]), beatAnchorTime)
        expect(facts).toEqual([
            {
                type: 'Object Relation Changed',
                subjectId: trayId,
                targetId: glassId,
                hostId: roomId,
                relationKind: 'ConnectedTo',
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
        const step: MutationKernelStep = { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, hostId: roomId, relationKind: 'ConnectedTo' }
        const facts = factsForStep(step, graphsMap([roomId, finalGraph]), beatAnchorTime)
        expect(facts).toEqual([
            {
                type: 'Object Relation Changed',
                subjectId: trayId,
                targetId: tableId,
                hostId: roomId,
                relationKind: 'ConnectedTo',
                operation: 'dissolve',
                beatAnchorTime,
            },
        ])
    })

    it('establishRelation with a non-Object (Character) subject emits its Object Relation Changed fact, host re-derived via nodeIds', () => {
        const finalGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Character', universalKey: characterId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: characterId, to: tableId, kind: 'ConnectedTo' }],
        })
        const step: MutationKernelStep = { kind: 'establishRelation', subjectId: characterId, targetId: tableId, hostId: roomId, relationKind: 'ConnectedTo' }
        const facts = factsForStep(step, graphsMap([roomId, finalGraph]), beatAnchorTime)
        expect(facts).toEqual([
            {
                type: 'Object Relation Changed',
                subjectId: characterId,
                targetId: tableId,
                hostId: roomId,
                relationKind: 'ConnectedTo',
                operation: 'establish',
                beatAnchorTime,
            },
        ])
    })

    it('dissolveRelation falls back to priorGraphs when the subject was removed entirely (destroy sequence)', () => {
        const finalGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: tableId }] })
        const priorGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'ConnectedTo' }],
        })
        const step: MutationKernelStep = { kind: 'dissolveRelation', subjectId: trayId, targetId: tableId, hostId: roomId, relationKind: 'ConnectedTo' }
        const facts = factsForStep(step, graphsMap([roomId, finalGraph]), beatAnchorTime, graphsMap([roomId, priorGraph]))
        expect(facts).toEqual([
            {
                type: 'Object Relation Changed',
                subjectId: trayId,
                targetId: tableId,
                hostId: roomId,
                relationKind: 'ConnectedTo',
                operation: 'dissolve',
                beatAnchorTime,
            },
        ])
    })

    it('a setHostingKind step yields no facts: a hosting kind is not a relation (HK-8)', () => {
        const step: MutationKernelStep = { kind: 'setHostingKind', hostId: roomId, memberId: trayId, hostingKind: 'On' }
        expect(factsForStep(step, graphsMap([roomId, testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId, hostingKind: 'On' }] })]), beatAnchorTime)).toEqual([])
    })

    it('a capture step yields no facts --- it is not a world event', () => {
        const step: MutationKernelStep = { kind: 'capture', hostId: roomId, captureId: 'before' }
        expect(factsForStep(step, graphsMap(), beatAnchorTime)).toEqual([])
    })

    it('a createComponent step yields no facts --- the placement that follows it announces arrival', () => {
        const step: MutationKernelStep = {
            kind: 'createComponent',
            hostId: trayId,
            meta: { EphemeraId: trayId, DataCategory: 'Meta::Object', stableKey: 'tray' },
        }
        expect(factsForStep(step, graphsMap(), beatAnchorTime)).toEqual([])
    })

    it('a destroyComponent step yields no facts --- the release that precedes it announces departure', () => {
        const step: MutationKernelStep = { kind: 'destroyComponent', hostId: trayId }
        expect(factsForStep(step, graphsMap(), beatAnchorTime)).toEqual([])
    })

    it('addCrossingPort/removeCrossingPort steps yield no facts --- not a narration channel yet, same as the presence binding steps', () => {
        const addStep: MutationKernelStep = {
            kind: 'addCrossingPort',
            hostId: tableId,
            port: { portId: 'p1', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'to' },
        }
        const removeStep: MutationKernelStep = { kind: 'removeCrossingPort', hostId: tableId, portId: 'p1' }
        expect(factsForStep(addStep, graphsMap(), beatAnchorTime)).toEqual([])
        expect(factsForStep(removeStep, graphsMap(), beatAnchorTime)).toEqual([])
    })

    it('addPresenceBinding/reparentPresenceBinding/repairPresenceBinding steps yield no facts --- not a narration channel yet', () => {
        const addStep: MutationKernelStep = {
            kind: 'addPresenceBinding',
            hostId: trayId,
            fromHostPresences: [{ host: roomId, presence: parentRemainderKey(roomId) }],
            presenceUuid: 'p2',
        }
        const rehostStep: MutationKernelStep = { kind: 'reparentPresenceBinding', hostId: trayId, presence: 'PRESENCE#p4' as any, lose: [{ host: roomId, presence: parentRemainderKey(roomId) }] }
        const moveStep: MutationKernelStep = { kind: 'reparentPresenceBinding', hostId: trayId, presence: 'PRESENCE#p3' as any, gain: [{ host: roomId, presence: 'PRESENCE#r' as any }] }
        expect(factsForStep(moveStep, graphsMap(), beatAnchorTime)).toEqual([])
        expect(factsForStep(addStep, graphsMap(), beatAnchorTime)).toEqual([])
        expect(factsForStep(rehostStep, graphsMap(), beatAnchorTime)).toEqual([])
        const repairStep: MutationKernelStep = { kind: 'repairPresenceBinding', hostId: trayId, presenceId: 'PRESENCE#p2', fromHostPresences: [], cover: { members: [] } }
        expect(factsForStep(repairStep, graphsMap(), beatAnchorTime)).toEqual([])
    })

    it('a leg with a port-address endpoint yields no fact --- no established fact shape yet for a port-qualified relation', () => {
        const step: MutationKernelStep = {
            kind: 'establishRelation',
            subjectId: trayId,
            targetId: { owner: tableId, port: 'p1' },
            hostId: roomId,
            relationKind: 'Custom',
            relationLabel: 'to',
        }
        expect(factsForStep(step, graphsMap(), beatAnchorTime)).toEqual([])
    })
})

describe('factForRelationalEdge', () => {
    it('a crossing edge yields one fact naming its real subject and target, hosted on the subject\'s graph', () => {
        // tray sits in the room; glass sits on the table, whose own graph holds it.
        const roomGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: { owner: tableId, port: 'p1' }, kind: 'Custom', relationLabel: 'tied to' }],
        })
        const tableGraph = testLudicGraph(tableId, {
            nodes: [
                { tag: 'Object', universalKey: tableId },
                { tag: 'Object', universalKey: glassId },
            ],
            ports: [{ portId: 'p1', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'tied to' }],
            edges: [{ tag: 'Relational', from: { owner: tableId, port: 'p1' }, to: glassId, kind: 'Custom', relationLabel: 'tied to' }],
        })
        const fact = factForRelationalEdge(
            { subjectId: trayId, targetId: glassId, operation: 'establish', relationKind: 'Custom', relationLabel: 'tied to' },
            graphsMap([roomId, roomGraph], [tableId, tableGraph]),
            beatAnchorTime
        )
        expect(fact).toEqual({
            type: 'Object Relation Changed',
            subjectId: trayId,
            targetId: glassId,
            hostId: roomId,
            relationKind: 'Custom',
            relationLabel: 'tied to',
            operation: 'establish',
            beatAnchorTime,
        })
    })
})
