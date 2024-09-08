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

})