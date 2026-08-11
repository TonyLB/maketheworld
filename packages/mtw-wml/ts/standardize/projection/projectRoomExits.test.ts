import StandardArea from '../components/area'
import { StandardExitEdgeData } from '../keys/edges/dataTypes/exitEdge'
import { projectRoomExits } from './projectRoomExits'

const highway = 'ROOM#highway' as const
const townCenter = 'ROOM#townCenter' as const
const outsideRoom = 'ROOM#outsideRoom' as const
const loopRoom = 'ROOM#loop' as const

function exitFacetTargets(exits: ReturnType<typeof projectRoomExits>) {
    return exits.items.map((facet) => ({
        target: facet.reference.universalKey ?? facet.reference.key,
        label: facet.payload.toJSON(),
    }))
}

describe('projectRoomExits', () => {
    it('projects Forward from from-room and Back from to-room (normal A to B)', () => {
        const area = new StandardArea({
            tag: 'Area',
            key: 'region',
            universalKey: 'AREA#region',
            ludicGraph: {
                nodes: [
                    { tag: 'Room', universalKey: highway },
                    { tag: 'Room', universalKey: townCenter },
                ],
                edges: [{
                    tag: 'Exit',
                    uuid: 'highwayToTown',
                    from: highway,
                    to: townCenter,
                    payload: { forward: 'east', back: 'west' },
                }],
            },
        })

        expect(exitFacetTargets(projectRoomExits(highway, [area]))).toEqual([
            { target: townCenter, label: 'east' },
        ])
        expect(exitFacetTargets(projectRoomExits(townCenter, [area]))).toEqual([
            { target: highway, label: 'west' },
        ])
    })

    it('emits up to two facets for self-loop when From and To are the same room', () => {
        const area = new StandardArea({
            tag: 'Area',
            key: 'region',
            ludicGraph: {
                nodes: [{ tag: 'Room', universalKey: loopRoom }],
                edges: [{
                    tag: 'Exit',
                    uuid: 'loopEdge',
                    from: loopRoom,
                    to: loopRoom,
                    payload: { forward: 'continue', back: 'return' },
                }],
            },
        })

        expect(exitFacetTargets(projectRoomExits(loopRoom, [area]))).toEqual([
            { target: loopRoom, label: 'continue' },
            { target: loopRoom, label: 'return' },
        ])
    })

    it('projects one facet from in-graph room for portal edge (participant endpoint rule)', () => {
        const area = new StandardArea({
            tag: 'Area',
            key: 'region',
            ludicGraph: {
                nodes: [{ tag: 'Room', universalKey: highway }],
                edges: [{
                    tag: 'Exit',
                    uuid: 'portal',
                    from: highway,
                    to: outsideRoom,
                    payload: { forward: 'east', back: 'west' },
                }],
            },
        })

        expect(exitFacetTargets(projectRoomExits(highway, [area]))).toEqual([
            { target: outsideRoom, label: 'east' },
        ])
        expect(exitFacetTargets(projectRoomExits(outsideRoom, [area]))).toEqual([
            { target: highway, label: 'west' },
        ])
    })

    it('unions facets from multiple Areas in caller order', () => {
        const areaA = new StandardArea({
            tag: 'Area',
            key: 'areaA',
            universalKey: 'AREA#areaA',
            ludicGraph: {
                nodes: [{ tag: 'Room', universalKey: highway }],
                edges: [{
                    tag: 'Exit',
                    uuid: 'aEdge',
                    from: highway,
                    to: townCenter,
                    payload: { forward: 'north', back: 'south' },
                }],
            },
        })
        const areaB = new StandardArea({
            tag: 'Area',
            key: 'areaB',
            universalKey: 'AREA#areaB',
            ludicGraph: {
                nodes: [{ tag: 'Room', universalKey: highway }],
                edges: [{
                    tag: 'Exit',
                    uuid: 'bEdge',
                    from: highway,
                    to: outsideRoom,
                    payload: { forward: 'east', back: 'west' },
                }],
            },
        })

        expect(exitFacetTargets(projectRoomExits(highway, [areaA, areaB]))).toEqual([
            { target: townCenter, label: 'north' },
            { target: outsideRoom, label: 'east' },
        ])
    })

    it('projects merged layered Area edges after uuid merge (D15, D5b)', () => {
        const base = new StandardArea({
            tag: 'Area',
            key: 'region',
            ludicGraph: {
                nodes: [{ tag: 'Room', universalKey: highway }],
                edges: [{
                    tag: 'Exit',
                    uuid: 'highwayToTown',
                    from: highway,
                    to: townCenter,
                    payload: { forward: 'east', back: 'west' },
                }],
            },
        })
        const incoming = new StandardArea({
            tag: 'Area',
            key: 'region',
            ludicGraph: {
                edges: [{
                    tag: 'Exit',
                    uuid: 'highwayToTown',
                    from: highway,
                    to: { tag: 'Replace', match: townCenter, payload: 'ROOM#ghi' },
                    payload: { forward: 'east', back: 'west' },
                }],
            },
        })
        const merged = base.merge(incoming)! as StandardArea

        expect(exitFacetTargets(projectRoomExits(highway, [merged]))).toEqual([
            { target: 'ROOM#ghi', label: 'east' },
        ])
    })

    it('emits distinct facets for duplicate room pairs with distinct edge uuids (D5)', () => {
        const area = new StandardArea({
            tag: 'Area',
            key: 'region',
            ludicGraph: {
                nodes: [
                    { tag: 'Room', universalKey: highway },
                    { tag: 'Room', universalKey: townCenter },
                ],
                edges: [
                    {
                        tag: 'Exit',
                        uuid: 'door',
                        from: highway,
                        to: townCenter,
                        payload: { forward: 'door', back: 'door' },
                    },
                    {
                        tag: 'Exit',
                        uuid: 'window',
                        from: highway,
                        to: townCenter,
                        payload: { forward: 'window', back: 'window' },
                    },
                ],
            },
        })

        expect(exitFacetTargets(projectRoomExits(highway, [area]))).toEqual([
            { target: townCenter, label: 'door' },
            { target: townCenter, label: 'window' },
        ])
    })

    it('skips facets when peer is not a ROOM# universal key (D17)', () => {
        const area = new StandardArea({
            tag: 'Area',
            key: 'region',
            ludicGraph: {
                nodes: [{ tag: 'Room', universalKey: highway }],
                edges: [{
                    tag: 'Exit',
                    uuid: 'toFeature',
                    from: highway,
                    to: { tag: 'Feature', key: 'gate' },
                    payload: { forward: 'through', back: 'back' },
                } as StandardExitEdgeData],
            },
        })

        expect(projectRoomExits(highway, [area]).items).toHaveLength(0)
    })

    describe('incomplete and non-participant edges (semantic filter boundary)', () => {
        it('returns zero facets for uuid-only edge', () => {
            const area = new StandardArea({
                tag: 'Area',
                key: 'region',
                ludicGraph: {
                    nodes: [{ tag: 'Room', universalKey: highway }],
                    edges: [{
                        tag: 'Exit',
                        uuid: 'edge-a1b2c3d4',
                        payload: {},
                    }],
                },
            })

            expect(projectRoomExits(highway, [area]).items).toHaveLength(0)
        })

        it('returns zero facets for from-only edge', () => {
            const area = new StandardArea({
                tag: 'Area',
                key: 'region',
                ludicGraph: {
                    nodes: [{ tag: 'Room', universalKey: highway }],
                    edges: [{
                        tag: 'Exit',
                        uuid: 'e1',
                        from: highway,
                        payload: { forward: 'east' },
                    }],
                },
            })

            expect(projectRoomExits(highway, [area]).items).toHaveLength(0)
        })

        it('returns zero facets for to-only edge', () => {
            const area = new StandardArea({
                tag: 'Area',
                key: 'region',
                ludicGraph: {
                    nodes: [{ tag: 'Room', universalKey: highway }],
                    edges: [{
                        tag: 'Exit',
                        uuid: 'e1',
                        to: highway,
                        payload: { back: 'west' },
                    }],
                },
            })

            expect(projectRoomExits(highway, [area]).items).toHaveLength(0)
        })

        it('returns zero facets for participant room not touching orphan edge (projection does not enforce participant rule)', () => {
            const area = new StandardArea({
                tag: 'Area',
                key: 'region',
                ludicGraph: {
                    nodes: [{ tag: 'Room', universalKey: highway }],
                    edges: [{
                        tag: 'Exit',
                        uuid: 'orphan',
                        from: townCenter,
                        to: outsideRoom,
                        payload: { forward: 'east', back: 'west' },
                    }],
                },
            })

            expect(projectRoomExits(highway, [area]).items).toHaveLength(0)
            expect(exitFacetTargets(projectRoomExits(townCenter, [area]))).toEqual([
                { target: outsideRoom, label: 'east' },
            ])
        })
    })

    it('returns empty ExitFacetList when no edges touch the room', () => {
        const area = new StandardArea({
            tag: 'Area',
            key: 'region',
            ludicGraph: {
                nodes: [
                    { tag: 'Room', universalKey: highway },
                    { tag: 'Room', universalKey: townCenter },
                ],
                edges: [{
                    tag: 'Exit',
                    uuid: 'other',
                    from: townCenter,
                    to: outsideRoom,
                    payload: { forward: 'out', back: 'in' },
                }],
            },
        })

        expect(projectRoomExits(highway, [area]).items).toHaveLength(0)
    })
})
