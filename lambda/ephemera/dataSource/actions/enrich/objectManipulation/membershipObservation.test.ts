import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardExitEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge'

import {
    observeMembershipForObject,
    objectTouchesExitEdgeOnGraph,
} from './membershipObservation'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const vaseId = 'OBJECT#Vase' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const tableId = 'OBJECT#Table' as EphemeraObjectId

describe('observeMembershipForObject', () => {
    it('returns containers only when more than one host', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId, 'CHARACTER#Alfred'])
        const getPositionGraph = jest.fn()

        const result = await observeMembershipForObject(broomId, {
            getMembershipContainers,
            getPositionGraph,
        })

        expect(result).toEqual({ containers: [roomId, 'CHARACTER#Alfred'] })
        expect(getPositionGraph).not.toHaveBeenCalled()
    })

    it('fetches positionGraph for sole host', async () => {
        const graph: PlayPositionGraph = { nodes: [{ tag: 'Object', universalKey: broomId }] }
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getPositionGraph = jest.fn().mockResolvedValue(graph)

        const result = await observeMembershipForObject(broomId, {
            getMembershipContainers,
            getPositionGraph,
        })

        expect(result).toEqual({ containers: [roomId], positionGraph: graph })
        expect(getPositionGraph).toHaveBeenCalledWith(roomId)
    })
})

describe('objectTouchesExitEdgeOnGraph', () => {
    it('returns false when graph has no edges', () => {
        expect(objectTouchesExitEdgeOnGraph({ nodes: [], edges: [] }, broomId)).toBe(false)
    })

    it('returns true when an exit edge references the object', () => {
        const edge: StandardExitEdgeData = {
            tag: 'Exit',
            uuid: 'edge-1',
            from: broomId,
            to: tableId,
            payload: {},
        }
        const graph: PlayPositionGraph = { edges: [edge] }

        expect(objectTouchesExitEdgeOnGraph(graph, broomId)).toBe(true)
        expect(objectTouchesExitEdgeOnGraph(graph, vaseId)).toBe(false)
    })

    it('returns true when object appears on to endpoint only', () => {
        const edge: StandardExitEdgeData = {
            tag: 'Exit',
            uuid: 'edge-2',
            from: tableId,
            to: broomId,
            payload: {},
        }

        expect(objectTouchesExitEdgeOnGraph({ edges: [edge] }, broomId)).toBe(true)
    })
})
