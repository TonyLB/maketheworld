import { GenericTree } from './baseClasses'
import { filter } from './filter'

describe('tree filter', () => {
    it('should filter a flat generic tree', () => {
        const testTree: GenericTree<string> = [
            { data: 'A', children: [{ data: 'AB', children: [] }, { data: 'C', children: [] }]},
            { data: 'D', children: [] }
        ]
        expect(filter({ tree: testTree, callback: (value: string): boolean => (value.startsWith('A'))})).toEqual([
            { data: 'A', children: [{ data: 'AB', children: [] }] }
        ])
    })

    it('should filter a GenericIDTree', () => {
        const testTree: GenericTree<string, { id: string }> = [
            { data: 'A', id: 'A', children: [{ data: 'B', id: 'AB', children: [] }, { data: 'C', id: 'C', children: [] }]},
            { data: 'D', id: 'D', children: [] }
        ]
        expect(filter({ tree: testTree, callback: (value: string, { id }: { id: string }): boolean => (id.startsWith('A'))})).toEqual([
            { data: 'A', id: 'A', children: [{ data: 'B', id: 'AB', children: [] }] }
        ])
    })
})