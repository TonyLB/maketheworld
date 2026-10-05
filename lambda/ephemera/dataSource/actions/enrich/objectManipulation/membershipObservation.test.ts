import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardLudicNavigationEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/ludicEdge'

import { testLudicGraph, testLudicGraphFromEnvelope } from '../../../positions/ludicGraph/testFixtures'
import { objectTouchesExitEdgeOnGraph } from './membershipObservation'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const vaseId = 'OBJECT#Vase' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const tableId = 'OBJECT#Table' as EphemeraObjectId

describe('objectTouchesExitEdgeOnGraph', () => {
    it('returns false when graph has no edges', () => {
        expect(objectTouchesExitEdgeOnGraph(testLudicGraph(roomId), broomId)).toBe(false)
    })

    it('returns true when an exit edge references the object', () => {
        const edge: StandardLudicNavigationEdgeData = {
            kind: 'Navigation',
            uuid: 'edge-1',
            from: broomId,
            to: tableId,
            payload: {},
        }
        const graph = testLudicGraphFromEnvelope(roomId, { nodes: [], edges: [edge] })

        expect(objectTouchesExitEdgeOnGraph(graph, broomId)).toBe(true)
        expect(objectTouchesExitEdgeOnGraph(graph, vaseId)).toBe(false)
    })

    it('returns true when object appears on to endpoint only', () => {
        const edge: StandardLudicNavigationEdgeData = {
            kind: 'Navigation',
            uuid: 'edge-2',
            from: tableId,
            to: broomId,
            payload: {},
        }
        const graph = testLudicGraphFromEnvelope(roomId, { nodes: [], edges: [edge] })

        expect(objectTouchesExitEdgeOnGraph(graph, broomId)).toBe(true)
    })
})
