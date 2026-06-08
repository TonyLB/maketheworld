import StandardArea from './area'
import { StandardExitEdge } from '../keys/edges/exitEdge'
import {
    assertEdgeSatisfiesParticipantRule,
    edgeSatisfiesParticipantRule,
    findEdgesViolatingParticipantRule,
} from './areaTopologyValidation'

describe('areaTopologyValidation', () => {
    const areaWithNodes = new StandardArea({
        tag: 'Area',
        key: 'region',
        positionGraph: {
            nodes: [
                { tag: 'Room', key: 'highway' },
                { tag: 'Room', key: 'townCenter' },
            ],
            edges: [],
        },
    })

    const bothInGraphEdge = new StandardExitEdge({
        tag: 'Exit',
        uuid: 'e1',
        from: { tag: 'Room', key: 'highway' },
        to: { tag: 'Room', key: 'townCenter' },
        payload: {},
    })

    const portalEdge = new StandardExitEdge({
        tag: 'Exit',
        uuid: 'e2',
        from: { tag: 'Room', key: 'highway' },
        to: { tag: 'Room', key: 'outside' },
        payload: {},
    })

    const orphanEdge = new StandardExitEdge({
        tag: 'Exit',
        uuid: 'e3',
        from: { tag: 'Room', key: 'roomA' },
        to: { tag: 'Room', key: 'roomB' },
        payload: {},
    })

    const uuidOnlyEdge = new StandardExitEdge({
        tag: 'Exit',
        uuid: 'edge-a1b2c3d4',
        payload: {},
    })

    describe('edgeSatisfiesParticipantRule', () => {
        it('should return true when both endpoints are in nodes', () => {
            expect(edgeSatisfiesParticipantRule(areaWithNodes, bothInGraphEdge)).toBe(true)
        })

        it('should return true for portal edge when only one endpoint is in nodes', () => {
            expect(edgeSatisfiesParticipantRule(areaWithNodes, portalEdge)).toBe(true)
        })

        it('should return false when both endpoints resolve but neither is in nodes', () => {
            expect(edgeSatisfiesParticipantRule(areaWithNodes, orphanEdge)).toBe(false)
        })

        it('should return true for incomplete edges (rule not applicable)', () => {
            expect(edgeSatisfiesParticipantRule(areaWithNodes, uuidOnlyEdge)).toBe(true)
        })
    })

    describe('findEdgesViolatingParticipantRule', () => {
        it('should return only fully resolved edges with no participant endpoint', () => {
            const area = new StandardArea({
                tag: 'Area',
                key: 'region',
                positionGraph: {
                    nodes: [{ tag: 'Room', key: 'highway' }],
                    edges: [
                        bothInGraphEdge.toJSON(),
                        portalEdge.toJSON(),
                        orphanEdge.toJSON(),
                        uuidOnlyEdge.toJSON(),
                    ],
                },
            })
            const violating = findEdgesViolatingParticipantRule(area)
            expect(violating.map((edge) => edge.uuid)).toEqual(['e3'])
        })
    })

    describe('assertEdgeSatisfiesParticipantRule', () => {
        it('should not throw for valid edges', () => {
            expect(() => assertEdgeSatisfiesParticipantRule(areaWithNodes, bothInGraphEdge)).not.toThrow()
        })

        it('should throw for orphan edges', () => {
            expect(() => assertEdgeSatisfiesParticipantRule(areaWithNodes, orphanEdge))
                .toThrow(/requires at least one endpoint in positionGraph.nodes/)
        })

        it('should not throw for incomplete edges', () => {
            expect(() => assertEdgeSatisfiesParticipantRule(areaWithNodes, uuidOnlyEdge)).not.toThrow()
        })
    })
})
