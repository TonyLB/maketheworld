import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardAreaData } from "./dataTypes/area"
import StandardArea from './area'
import { StandardExitEdgeData } from "../keys/edges/dataTypes/exitEdge"
import StandardReference from "../keys/reference"
import { standardComponentFactory } from "../componentFactory"

describe('StandardArea class', () => {

    const heterogeneousAreaData: StandardAreaData = {
        tag: 'Area',
        key: 'downtown',
        universalKey: 'AREA#downtown',
        shortName: 'Downtown',
        positionGraph: {
            nodes: [
                { tag: 'Area', key: 'oldTown' },
                { tag: 'Room', key: 'cafe' },
                { tag: 'Feature', key: 'fountain' },
                { tag: 'Character', key: 'guard' },
            ],
        },
    }

    it('should construct StandardArea from StandardAreaData', () => {
        const testArea = new StandardArea(heterogeneousAreaData)
        expect(testArea.key).toEqual('downtown')
        expect(testArea.universalKey).toEqual('AREA#downtown')
        expect(testArea.shortName?.toJSON()).toEqual('Downtown')
        expect(testArea.positionGraph.nodes.toJSON()).toEqual(heterogeneousAreaData.positionGraph!.nodes)
        expect(testArea.toJSON()).toEqual(heterogeneousAreaData)
    })

    it('should omit empty positionGraph in toJSON', () => {
        const testArea = new StandardArea({ tag: 'Area', key: 'empty' })
        expect(testArea.toJSON()).toEqual({ tag: 'Area', key: 'empty' })
        expect('positionGraph' in testArea.toJSON()).toBe(false)
    })

    it('should construct from schema with four reference consumers appending to nodes', () => {
        const node: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Area', key: 'downtown' },
            children: [
                { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'Downtown' }, children: [] }] },
                { data: { tag: 'Area', key: 'oldTown' }, children: [] },
                { data: { tag: 'Room', key: 'cafe' }, children: [] },
                { data: { tag: 'Feature', key: 'fountain' }, children: [] },
                { data: { tag: 'Character', key: 'guard' }, children: [] },
            ],
        }
        const instance = new StandardArea(undefined as any)
        instance.fromSchema(node)
        expect(instance.positionGraph.nodes.toJSON()).toEqual([
            { tag: 'Area', key: 'oldTown' },
            { tag: 'Room', key: 'cafe' },
            { tag: 'Feature', key: 'fountain' },
            { tag: 'Character', key: 'guard' },
        ])
        expect(instance.shortName?.toJSON()).toEqual('Downtown')
    })

    it('should reject legacy Exit to= under Area (D29)', () => {
        const node: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Area', key: 'test' },
            children: [
                { data: { tag: 'Room', key: 'room1' }, children: [] },
                { data: { tag: 'Exit', to: 'other' }, children: [] },
            ],
        }
        const instance = new StandardArea(undefined as any)
        expect(() => instance.fromSchema(node)).toThrow(/rejects to= attribute/)
    })

    it('should ingest D29 Exit into positionGraph.edges', () => {
        const node: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Area', key: 'region' },
            children: [
                { data: { tag: 'Room', key: 'highway' }, children: [] },
                { data: { tag: 'Room', key: 'townCenter' }, children: [] },
                {
                    data: { tag: 'Exit', uuid: 'highwayToTown' },
                    children: [
                        { data: { tag: 'From' }, children: [{ data: { tag: 'String', value: 'highway' }, children: [] }] },
                        { data: { tag: 'To' }, children: [{ data: { tag: 'String', value: 'townCenter' }, children: [] }] },
                        { data: { tag: 'Forward' }, children: [{ data: { tag: 'String', value: 'east' }, children: [] }] },
                        { data: { tag: 'Back' }, children: [{ data: { tag: 'String', value: 'west' }, children: [] }] },
                    ],
                },
            ],
        }
        const instance = new StandardArea(undefined as any)
        instance.fromSchema(node)
        expect(instance.positionGraph.edges.toJSON()).toEqual([{
            tag: 'Exit',
            uuid: 'highwayToTown',
            from: { key: 'highway', tag: 'Room' },
            to: { key: 'townCenter', tag: 'Room' },
            payload: { forward: 'east', back: 'west' },
        }])
    })

    it('should merge positionGraph edges by uuid', () => {
        const base = new StandardArea({
            tag: 'Area',
            key: 'region',
            positionGraph: {
                nodes: [{ tag: 'Room', universalKey: 'ROOM#highway' }],
                edges: [{
                    tag: 'Exit',
                    uuid: 'highwayToTown',
                    from: 'ROOM#highway',
                    to: 'ROOM#townCenter',
                    payload: { forward: 'east', back: 'west' },
                }],
            },
        })
        const incoming = new StandardArea({
            tag: 'Area',
            key: 'region',
            positionGraph: {
                edges: [{
                    tag: 'Exit',
                    uuid: 'highwayToTown',
                    from: 'ROOM#highway',
                    to: { tag: 'Replace', match: 'ROOM#townCenter', payload: 'ROOM#ghi' },
                    payload: { forward: 'east', back: 'west' },
                }],
            },
        })
        const merged = base.merge(incoming)! as StandardArea
        expect((merged.positionGraph.edges.toJSON()[0] as StandardExitEdgeData).to).toEqual('ROOM#ghi')
    })

    it('should reject self-reference in positionGraph.nodes from JSON', () => {
        expect(() => new StandardArea({
            tag: 'Area',
            key: 'downtown',
            positionGraph: {
                nodes: [{ tag: 'Area', key: 'downtown' }],
            },
        })).toThrow('Area cannot reference itself in positionGraph.nodes')
    })

    it('should reject self-reference by universalKey from JSON', () => {
        expect(() => new StandardArea({
            tag: 'Area',
            key: 'downtown',
            universalKey: 'AREA#downtown',
            positionGraph: {
                nodes: [{ tag: 'Area', universalKey: 'AREA#downtown' }],
            },
        })).toThrow('Area cannot reference itself in positionGraph.nodes')
    })

    it('should reject self-reference from schema', () => {
        const node: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Area', key: 'downtown', uuid: 'AREA#downtown' },
            children: [
                { data: { tag: 'Area', key: 'downtown' }, children: [] },
            ],
        }
        const instance = new StandardArea(undefined as any)
        expect(() => instance.fromSchema(node)).toThrow('Area cannot reference itself in positionGraph.nodes')
    })

    it('should merge positionGraph nodes', () => {
        const base = new StandardArea({
            tag: 'Area',
            key: 'region',
            positionGraph: {
                nodes: [{ tag: 'Room', key: 'cafe' }],
            },
        })
        const incoming = new StandardArea({
            tag: 'Area',
            key: 'region',
            positionGraph: {
                nodes: [{ tag: 'Feature', key: 'fountain' }],
            },
        })
        const merged = base.merge(incoming) as StandardArea
        expect(merged.positionGraph.nodes.toJSON()).toEqual([
            { tag: 'Room', key: 'cafe' },
            { tag: 'Feature', key: 'fountain' },
        ])
    })

    it('should treat undefined and empty shortName as equal', () => {
        const withoutShortName = new StandardArea({
            tag: 'Area',
            key: 'test',
            positionGraph: { nodes: [{ tag: 'Room', key: 'r1' }] },
        })
        const withEmptyShortName = new StandardArea({
            tag: 'Area',
            key: 'test',
            shortName: '',
            positionGraph: { nodes: [{ tag: 'Room', key: 'r1' }] },
        })

        expect(withoutShortName.equals(withEmptyShortName)).toBe(true)
    })

    it('should no-op diff of identical objects', () => {
        const testArea = new StandardArea(heterogeneousAreaData)
        expect(testArea.diff(testArea)).toBeUndefined()
    })

    it('should add a child reference via withChild', () => {
        const test = new StandardArea({
            tag: 'Area',
            key: 'test',
            positionGraph: { nodes: [{ tag: 'Room', key: 'room1' }] },
        })
        const added = test.withChild(new StandardReference({ tag: 'Feature', key: 'feat1' })) as StandardArea
        expect(added.positionGraph.nodes.toJSON()).toEqual([
            { tag: 'Room', key: 'room1' },
            { tag: 'Feature', key: 'feat1' },
        ])
    })

    it('should throw on invalid withChild tag', () => {
        const test = new StandardArea({ tag: 'Area', key: 'test' })
        expect(() => test.withChild(new StandardReference({ tag: 'Map', key: 'map1' })))
            .toThrow(/Invalid child type Map/)
    })

    it('should expose referencedKeys as Direct and Dependency', () => {
        const testArea = new StandardArea({
            tag: 'Area',
            key: 'test',
            positionGraph: { nodes: [{ tag: 'Room', key: 'room1' }] },
        })
        const keys = testArea._payload.referencedKeys()
        expect(keys).toHaveLength(2)
        expect(keys.every((k) => k.reference.key === 'room1')).toBe(true)
        expect(keys.map((k) => k.referenceType).sort()).toEqual(['Dependency', 'Direct'])
    })

    it('should expose Edge referencedKeys for exit endpoints', () => {
        const testArea = new StandardArea({
            tag: 'Area',
            key: 'region',
            positionGraph: {
                nodes: [{ tag: 'Room', key: 'highway' }],
                edges: [{
                    tag: 'Exit',
                    uuid: 'highwayToTown',
                    from: { tag: 'Room', key: 'highway' },
                    to: { tag: 'Room', key: 'outside' },
                    payload: { forward: 'east', back: 'west' },
                }],
            },
        })
        const keys = testArea._payload.referencedKeys()
        const edgeKeys = keys.filter((k) => k.referenceType === 'Edge')
        expect(edgeKeys).toHaveLength(2)
        expect(edgeKeys.some((k) => k.reference.key === 'highway')).toBe(true)
        expect(edgeKeys.some((k) => k.reference.key === 'outside')).toBe(true)
        expect(keys.filter((k) => k.referenceType === 'Direct')).toHaveLength(1)
        expect(keys.filter((k) => k.referenceType === 'Dependency')).toHaveLength(1)
    })

    describe('D4 positionGraph edge validation', () => {
        it('should accept edge when both endpoints are in nodes', () => {
            expect(() => new StandardArea({
                tag: 'Area',
                key: 'region',
                positionGraph: {
                    nodes: [
                        { tag: 'Room', key: 'highway' },
                        { tag: 'Room', key: 'townCenter' },
                    ],
                    edges: [{
                        tag: 'Exit',
                        uuid: 'e1',
                        from: { tag: 'Room', key: 'highway' },
                        to: { tag: 'Room', key: 'townCenter' },
                        payload: {},
                    }],
                },
            })).not.toThrow()
        })

        it('should accept portal edge when only one endpoint is in nodes', () => {
            expect(() => new StandardArea({
                tag: 'Area',
                key: 'region',
                positionGraph: {
                    nodes: [{ tag: 'Room', key: 'highway' }],
                    edges: [{
                        tag: 'Exit',
                        uuid: 'e1',
                        from: { tag: 'Room', key: 'highway' },
                        to: { tag: 'Room', key: 'outside' },
                        payload: {},
                    }],
                },
            })).not.toThrow()
        })

        it('should reject edge when neither endpoint is in nodes from JSON', () => {
            expect(() => new StandardArea({
                tag: 'Area',
                key: 'region',
                positionGraph: {
                    nodes: [{ tag: 'Room', key: 'unrelated' }],
                    edges: [{
                        tag: 'Exit',
                        uuid: 'e1',
                        from: { tag: 'Room', key: 'highway' },
                        to: { tag: 'Room', key: 'townCenter' },
                        payload: {},
                    }],
                },
            })).toThrow(/requires at least one endpoint in positionGraph.nodes \(D4\)/)
        })

        it('should reject edge when neither endpoint is in nodes from schema', () => {
            const node: GenericTreeNode<SchemaTag> = {
                data: { tag: 'Area', key: 'region' },
                children: [
                    { data: { tag: 'Room', key: 'unrelated' }, children: [] },
                    {
                        data: { tag: 'Exit', uuid: 'e1' },
                        children: [
                            { data: { tag: 'From' }, children: [{ data: { tag: 'String', value: 'highway' }, children: [] }] },
                            { data: { tag: 'To' }, children: [{ data: { tag: 'String', value: 'townCenter' }, children: [] }] },
                        ],
                    },
                ],
            }
            const instance = new StandardArea(undefined as any)
            expect(() => instance.fromSchema(node)).toThrow(/requires at least one endpoint in positionGraph.nodes \(D4\)/)
        })

        it('should reject merge when incoming edge has no endpoint in nodes', () => {
            const base = new StandardArea({
                tag: 'Area',
                key: 'region',
                positionGraph: {
                    nodes: [{ tag: 'Room', key: 'highway' }],
                    edges: [{
                        tag: 'Exit',
                        uuid: 'e1',
                        from: { tag: 'Room', key: 'highway' },
                        to: { tag: 'Room', key: 'outside' },
                        payload: {},
                    }],
                },
            })
            const incoming = new StandardArea({
                tag: 'Area',
                key: 'region',
                positionGraph: {
                    edges: [{
                        tag: 'Exit',
                        uuid: 'e2',
                        from: { tag: 'Room', key: 'roomA' },
                        to: { tag: 'Room', key: 'roomB' },
                        payload: {},
                    }],
                },
            })
            expect(() => base.merge(incoming)).toThrow(/requires at least one endpoint in positionGraph.nodes \(D4\)/)
        })
    })

    describe('assureReferences method', () => {
        it('should return unchanged area when children array is empty', () => {
            const area = new StandardArea({ tag: 'Area', key: 'test' })
            const { payload: result, inlineRemainder } = area._payload.assureReferences([])

            expect(result.positionGraph.nodes.payload.length).toBe(0)
            expect(inlineRemainder).toEqual([])
        })

        it('should add bucket children with ref={0}', () => {
            const area = new StandardArea({ tag: 'Area', key: 'test' })
            const roomRef = new StandardReference({ tag: 'Room', key: 'room1' })

            const { payload: result } = area._payload.assureReferences([roomRef])

            expect(result.positionGraph.nodes.payload.length).toBe(1)
            expect(result.positionGraph.nodes.payload[0].ref).toBe(0)
            expect(result.positionGraph.nodes.payload[0].sameKey(roomRef)).toBe(true)
        })

        it('should return non-bucket tags as inlineRemainder', () => {
            const area = new StandardArea({ tag: 'Area', key: 'test' })
            const mapRef = new StandardReference({ tag: 'Map', key: 'map1' })

            const { payload: result, inlineRemainder } = area._payload.assureReferences([mapRef])

            expect(result.positionGraph.nodes.payload.length).toBe(0)
            expect(inlineRemainder.length).toBe(1)
            expect(inlineRemainder[0].tag).toBe('Map')
        })
    })

    it('should construct via standardComponentFactory from JSON', () => {
        const { component } = standardComponentFactory(heterogeneousAreaData)
        expect(component).toBeInstanceOf(StandardArea)
        expect((component as StandardArea).positionGraph.nodes.payload.length).toBe(4)
    })

    it('should construct via standardComponentFactory from schema node', () => {
        const node: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Area', key: 'downtown' },
            children: [
                { data: { tag: 'Room', key: 'cafe' }, children: [] },
            ],
        }
        const { component } = standardComponentFactory(node)
        expect(component).toBeInstanceOf(StandardArea)
        expect((component as StandardArea).positionGraph.nodes.toJSON()).toEqual([{ tag: 'Room', key: 'cafe' }])
    })

    it('should invert positionGraph nodes', () => {
        const area = new StandardArea({
            tag: 'Area',
            key: 'test',
            positionGraph: { nodes: [{ tag: 'Room', key: 'room1', ref: 1 }] },
        })
        const inverted = area.invert()
        expect(inverted.positionGraph.nodes.payload[0].ref).toBeLessThan(0)
    })
})
