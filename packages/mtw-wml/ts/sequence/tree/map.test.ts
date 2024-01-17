import { GenericTree } from './baseClasses'
import { map } from './map'

describe('tree map', () => {
    it('should map a flat generic tree', () => {
        const testTree: GenericTree<string> = [
            { data: 'A', children: [{ data: 'B', children: [] }, { data: 'C', children: [] }]},
            { data: 'D', children: [] }
        ]
        expect(map(testTree, ({ data, children }): GenericTree<string> => ([{ data: `Test-${data}`, children }]))).toEqual([
            { data: 'Test-A', children: [{ data: 'Test-B', children: [] }, { data: 'Test-C', children: [] }]},
            { data: 'Test-D', children: [] }
        ])
    })

    it('should map a GenericIDTree', () => {
        const testTree: GenericTree<string, { id: string }> = [
            { data: 'A', id: 'A', children: [{ data: 'B', id: 'B', children: [] }, { data: 'C', id: 'C', children: [] }]},
            { data: 'D', id: 'D', children: [] }
        ]
        expect(map(testTree, ({ data, children, id }) => ([{ data: `Test-${data}`, children, id }]))).toEqual([
            { data: 'Test-A', id: 'A', children: [{ data: 'Test-B', id: 'B', children: [] }, { data: 'Test-C', id: 'C', children: [] }]},
            { data: 'Test-D', id: 'D', children: [] }
        ])
    })
})