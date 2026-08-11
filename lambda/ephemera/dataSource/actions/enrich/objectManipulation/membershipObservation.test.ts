import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardExitEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge'

import { testLudicGraph, testLudicGraphFromEnvelope } from '../../../positions/ludicGraph/testFixtures'
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
        const getLudicGraph = jest.fn()

        const result = await observeMembershipForObject(broomId, {
            getMembershipContainers,
            getLudicGraph,
        })

        expect(result).toEqual({ containers: [roomId, 'CHARACTER#Alfred'] })
        expect(getLudicGraph).not.toHaveBeenCalled()
    })

    it('fetches ludicGraph for sole host', async () => {
        const graph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Object', universalKey: broomId }],
        })
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getLudicGraph = jest.fn().mockResolvedValue(graph)

        const result = await observeMembershipForObject(broomId, {
            getMembershipContainers,
            getLudicGraph,
        })

        expect(result).toEqual({ containers: [roomId], ludicGraph: graph })
        expect(getLudicGraph).toHaveBeenCalledWith(roomId)
    })
})

describe('objectTouchesExitEdgeOnGraph', () => {
    it('returns false when graph has no edges', () => {
        expect(objectTouchesExitEdgeOnGraph(testLudicGraph(roomId), broomId)).toBe(false)
    })

    it('returns true when an exit edge references the object', () => {
        const edge: StandardExitEdgeData = {
            tag: 'Exit',
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
        const edge: StandardExitEdgeData = {
            tag: 'Exit',
            uuid: 'edge-2',
            from: tableId,
            to: broomId,
            payload: {},
        }
        const graph = testLudicGraphFromEnvelope(roomId, { nodes: [], edges: [edge] })

        expect(objectTouchesExitEdgeOnGraph(graph, broomId)).toBe(true)
    })
})
