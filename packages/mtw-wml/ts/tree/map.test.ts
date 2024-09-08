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

})