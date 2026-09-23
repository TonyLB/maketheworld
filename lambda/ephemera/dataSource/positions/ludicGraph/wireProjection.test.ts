import type {
    EphemeraAreaId,
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraObjectId,
    EphemeraPresenceNodeId,
    EphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isStandardLudicGraphPresenceNodeData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/ludicGraph'

import { testLudicGraph } from './testFixtures'
import { fromWireLudicGraph, toWireLudicGraph } from './wireProjection'

const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Lab' as EphemeraRoomId
const hallId = 'ROOM#Hall' as EphemeraRoomId
const charId = 'CHARACTER#Guard' as EphemeraCharacterId
const boxId = 'OBJECT#Box' as EphemeraObjectId
const featureId = 'FEATURE#Fountain' as EphemeraFeatureId
const areaId = 'AREA#Downtown' as EphemeraAreaId

const fullCover: EphemeraPresenceCover = { tag: 'Full' }
const enumeratedCover = (host: string, presence: string): EphemeraPresenceCover => ({
    tag: 'Enumerated',
    members: [{ host: host as any, presence: presence as EphemeraPresenceNodeId }],
})

describe('toWireLudicGraph / fromWireLudicGraph (Slice 4)', () => {
    describe('totality round-trip', () => {
        it('projects a stored graph carrying one of everything to the wire shape and back without loss', () => {
            const bindingUuid = 'binding1'
            const bindingId = `PRESENCE#${bindingUuid}` as EphemeraPresenceNodeId
            const graph = testLudicGraph(tableId, {
                nodes: [
                    { tag: 'Object', universalKey: tableId },
                    { tag: 'Room', universalKey: roomId },
                    { tag: 'Character', universalKey: charId },
                    { tag: 'Object', universalKey: boxId },
                    { tag: 'Feature', universalKey: featureId },
                    { tag: 'Area', universalKey: areaId },
                    { tag: 'Presence', universalKey: bindingId, fromHostId: roomId, cover: fullCover },
                    {
                        tag: 'Presence',
                        universalKey: 'PRESENCE#binding2' as EphemeraPresenceNodeId,
                        fromHostId: hallId,
                        cover: enumeratedCover(boxId, 'PRESENCE#box-binding'),
                    },
                ],
                edges: [
                    { tag: 'Relational', kind: 'In', from: boxId, to: tableId },
                    { tag: 'Relational', kind: 'On', from: featureId, to: tableId },
                    { tag: 'Relational', kind: 'PartOf', from: featureId, to: areaId, edgeId: 'route1', chainId: 'chain1' },
                    { tag: 'Relational', kind: 'Under', from: charId, to: areaId },
                    { tag: 'Relational', kind: 'Against', from: roomId, to: featureId },
                    { tag: 'Relational', kind: 'Custom', from: boxId, to: charId, relationLabel: 'Beside' },
                    // Port-qualified terminal (LG-11): an interior edge landing on this graph's
                    // own boundary port -- `owner: tableId` is `graph.hostId` itself, exactly the
                    // running example's `{owner: OBJECT#Box, port: 8f3a} -TiedTo-> OBJECT#Cup` shape.
                    { tag: 'Relational', kind: 'On', from: { owner: tableId, port: 'crossport1' }, to: boxId },
                    // Bare presence-node terminal (LG-11, PR-15/PN-6 clause (c)): an edge landing
                    // directly on this graph's own binding1 presence node.
                    { tag: 'Relational', kind: 'On', from: boxId, to: bindingId },
                ],
                ports: [
                    { portId: 'crossport1', fromHostId: roomId, kind: 'On' },
                ],
            })

            const wire = toWireLudicGraph(graph, bindingUuid)

            // Nothing is cut away: `bindingUuid`'s cover is Full, so the bucket is every
            // component node plus both presence nodes (carried unconditionally) plus the root.
            expect(wire.nodes).toHaveLength(8)
            expect(wire.edges).toHaveLength(8)
            expect(wire.ports).toHaveLength(1)

            const roundTripped = fromWireLudicGraph(tableId, wire)
            expect(roundTripped).toEqual(graph.toStored())
        })
    })

    describe('rope-shaped second-binding test', () => {
        const ropeId = 'OBJECT#Rope' as EphemeraObjectId
        const endAId = 'OBJECT#RopeEndA' as EphemeraObjectId
        const endBId = 'OBJECT#RopeEndB' as EphemeraObjectId
        const bindingAUuid = 'bindingA'
        const bindingAId = `PRESENCE#${bindingAUuid}` as EphemeraPresenceNodeId
        const bindingBId = 'PRESENCE#bindingB' as EphemeraPresenceNodeId

        const ropeGraph = testLudicGraph(ropeId, {
            nodes: [
                { tag: 'Object', universalKey: ropeId },
                { tag: 'Object', universalKey: endAId },
                { tag: 'Object', universalKey: endBId },
                { tag: 'Presence', universalKey: bindingAId, fromHostId: roomId, cover: enumeratedCover(endAId, 'PRESENCE#endA-binding') },
                { tag: 'Presence', universalKey: bindingBId, fromHostId: hallId, cover: enumeratedCover(endBId, 'PRESENCE#endB-binding') },
            ],
            edges: [
                { tag: 'Relational', kind: 'PartOf', from: endAId, to: ropeId },
                { tag: 'Relational', kind: 'PartOf', from: endBId, to: ropeId },
                { tag: 'Relational', kind: 'Custom', from: endAId, to: endBId, relationLabel: 'spliced to' },
            ],
        })

        it("does not cross a second binding's exclusive nodes, even though nothing mints one today", () => {
            const wire = toWireLudicGraph(ropeGraph, bindingAUuid)

            const componentEntries = (wire.nodes ?? []).filter((entry) => !isStandardLudicGraphPresenceNodeData(entry))
            const componentKeys = componentEntries.map((entry) => (typeof entry === 'string' ? entry : (entry as any).universalKey))

            expect(componentKeys).toEqual(expect.arrayContaining([ropeId, endAId]))
            expect(componentKeys).not.toContain(endBId)

            // Both presence nodes still cross -- they are carried into every bucket
            // unconditionally (PN-6), independent of which binding is being projected.
            const presenceKeys = (wire.nodes ?? [])
                .filter(isStandardLudicGraphPresenceNodeData)
                .map((entry) => entry.universalKey)
            expect(presenceKeys).toEqual(expect.arrayContaining([bindingAId, bindingBId]))
        })
    })

    describe('out-of-scope shapes throw rather than silently dropping', () => {
        it('rejects a Navigation-kind edge entry on the wire side', () => {
            expect(() => fromWireLudicGraph(tableId, {
                edges: [{ kind: 'Navigation', uuid: 'e1', payload: {} } as any],
            })).toThrow(/Navigation/)
        })
    })
})
