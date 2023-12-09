import { GenericTreeDiffAction } from './baseClasses';
import diffTrees from './diff'

type TestType = {
    key: string;
    value: string;
}

describe('diffTrees', () => {
    const options = {
        compare: ({ key: keyA }, { key: keyB }) => (keyA === keyB),
        extractProperties: ({ value }) => (value),
        rehydrateProperties: ({ key }, value) => ({ key, value: [...new Set(value)].join(':') })
    }

    it('should return empty on identical trees', () => {
        const testTree = [
            { data: { key: 'A', value: 'B' }, children: [
                { data: { key: 'D', value: 'D' }, children: [] },
                { data: { key: 'C', value: 'C' }, children: [] }
            ] }
        ]
        expect(diffTrees(options)(testTree, testTree)).toEqual([])
    })

    it('should return all adds when compared against empty tree', () => {
        const testTree = [
            { data: { key: 'A', value: 'B' }, children: [
                { data: { key: 'D', value: 'D' }, children: [] },
                { data: { key: 'C', value: 'C' }, children: [] }
            ] }
        ]
        expect(diffTrees(options)([], testTree)).toEqual([
            { 
                data: { key: 'A', value: 'B' },
                action: GenericTreeDiffAction.Add,
                children: [
                    { data: { key: 'D', value: 'D' }, action: GenericTreeDiffAction.Add, children: [] },
                    { data: { key: 'C', value: 'C' }, action: GenericTreeDiffAction.Add, children: [] }
                ]
            }
        ])
    })

    it('should compare simple overlapping trees', () => {
        const testTreeOne = [
            { data: { key: 'A', value: 'A' }, children: [
                { data: { key: 'B', value: 'B' }, children: [] },
                { data: { key: 'C', value: 'C' }, children: [
                    { data: { key: 'E', value: 'E' }, children: [] }
                ] }
            ] },
            { data: { key: 'F', value: 'F' }, children: [
                { data: { key: 'G', value: 'G' }, children: [] }
            ] },
            { data: { key: 'H', value: 'H' }, children: [] },
            { data: { key: 'I', value: 'J' }, children: [] }
        ]
        const testTreeTwo = [
            { data: { key: 'A', value: 'A' }, children: [
                { data: { key: 'C', value: 'C' }, children: [
                    { data: { key: 'F', value: 'F' }, children: [] }
                ] },
                { data: { key: 'D', value: 'D' }, children: [
                    { data: { key: 'C', value: 'C' }, children: [] }
                ] }
            ] },
            { data: { key: 'F', value: 'F' }, children: [
                { data: { key: 'G', value: 'G' }, children: [] }
            ] },
            { data: { key: 'H', value: 'H' }, children: [] },
            { data: { key: 'I', value: 'I' }, children: [] },
        ]
        expect(diffTrees(options)(testTreeOne, testTreeTwo)).toEqual([
            { 
                data: { key: 'A', value: 'A' },
                action: GenericTreeDiffAction.Context,
                children: [
                    { data: { key: 'B', value: 'B' }, action: GenericTreeDiffAction.Delete, children: [] },
                    {
                        data: { key: 'C', value: 'C' },
                        action: GenericTreeDiffAction.Context,
                        children: [
                            { data: { key: 'E', value: 'E' }, action: GenericTreeDiffAction.Delete, children: [] },
                            { data: { key: 'F', value: 'F' }, action: GenericTreeDiffAction.Add, children: [] }
                        ]
                    },
                    {
                        data: { key: 'D', value: 'D' },
                        action: GenericTreeDiffAction.Add,
                        children: [
                            { data: { key: 'C', value: 'C' }, action: GenericTreeDiffAction.Add, children: [] }
                        ]
                    },
                ]
            },
            {
                data: { key: 'H', value: 'H' },
                action: GenericTreeDiffAction.Context,
                children: []
            },
            {
                data: { key: 'I', value: 'I' },
                action: GenericTreeDiffAction.Set,
                children: []
            }
        ])
    })

    it('should include excluded branches when verbose option is set', () => {
        const testTreeOne = [
            { data: { key: 'A', value: 'A' }, children: [
                { data: { key: 'B', value: 'B' }, children: [] },
                { data: { key: 'C', value: 'C' }, children: [
                    { data: { key: 'E', value: 'E' }, children: [] }
                ] }
            ] },
            { data: { key: 'F', value: 'F' }, children: [
                { data: { key: 'G', value: 'G' }, children: [] }
            ] },
            { data: { key: 'H', value: 'H' }, children: [] },
            { data: { key: 'I', value: 'J' }, children: [] }
        ]
        const testTreeTwo = [
            { data: { key: 'A', value: 'A' }, children: [
                { data: { key: 'C', value: 'C' }, children: [
                    { data: { key: 'F', value: 'F' }, children: [] }
                ] },
                { data: { key: 'D', value: 'D' }, children: [
                    { data: { key: 'C', value: 'C' }, children: [] }
                ] }
            ] },
            { data: { key: 'F', value: 'F' }, children: [
                { data: { key: 'G', value: 'G' }, children: [] }
            ] },
            { data: { key: 'H', value: 'H' }, children: [] },
            { data: { key: 'I', value: 'I' }, children: [] },
        ]
        expect(diffTrees({ ...options, verbose: true })(testTreeOne, testTreeTwo)).toEqual([
            { 
                data: { key: 'A', value: 'A' },
                action: GenericTreeDiffAction.Context,
                children: [
                    { data: { key: 'B', value: 'B' }, action: GenericTreeDiffAction.Delete, children: [] },
                    {
                        data: { key: 'C', value: 'C' },
                        action: GenericTreeDiffAction.Context,
                        children: [
                            { data: { key: 'E', value: 'E' }, action: GenericTreeDiffAction.Delete, children: [] },
                            { data: { key: 'F', value: 'F' }, action: GenericTreeDiffAction.Add, children: [] }
                        ]
                    },
                    {
                        data: { key: 'D', value: 'D' },
                        action: GenericTreeDiffAction.Add,
                        children: [
                            { data: { key: 'C', value: 'C' }, action: GenericTreeDiffAction.Add, children: [] }
                        ]
                    },
                ]
            },
            {
                data: { key: 'F', value: 'F' },
                action: GenericTreeDiffAction.Exclude,
                children: [
                    { data: { key: 'G', value: 'G' }, children: [], action: GenericTreeDiffAction.Exclude }
                ]
            },
            {
                data: { key: 'H', value: 'H' },
                action: GenericTreeDiffAction.Context,
                children: []
            },
            {
                data: { key: 'I', value: 'I' },
                action: GenericTreeDiffAction.Set,
                children: []
            }
        ])
    })

})