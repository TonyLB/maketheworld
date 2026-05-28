import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardAreaData } from "./dataTypes/area"
import StandardArea from './area'
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

    it('should throw on unconsumed child tags', () => {
        const node: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Area', key: 'test' },
            children: [
                { data: { tag: 'Room', key: 'room1' }, children: [] },
                { data: { tag: 'Exit', to: 'other' }, children: [] },
            ],
        }
        const instance = new StandardArea(undefined as any)
        expect(() => instance.fromSchema(node)).toThrow(/Unconsumed child tags/)
        expect(() => instance.fromSchema(node)).toThrow(/Exit/)
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
        const merged = base.merge(incoming)
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
        const added = test.withChild(new StandardReference({ tag: 'Feature', key: 'feat1' }))
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
