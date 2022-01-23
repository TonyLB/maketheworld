import flatToNested, { consolidateToLevel } from './flatToNested'

interface ITest {
    name: string;
}

//
// TODO:  When flatToNested succeeds in its requirements, remove the tests
// and export for helper function consolidateToLevel
//
describe('consolidateToLevel', () => {
    const testTree = {
        levelsInProgress: [{
            item: { name: 'A' },
            children: [{
                item: { name: 'B' },
                children: []
            }]
        },
        {
            item: { name: 'C' },
            children: [{
                item: { name: 'D' },
                children: []
            }]
        },
        {
            item: { name: 'E' },
            children: []
        },
        {
            item: { name: 'F' },
            children: []
        }],
        rootOutput: [{
            item: { name: 'G' },
            children: [{
                item: { name: 'H' },
                children: []
            }]
        }]
    } as any

    it('returns unchanged for same or higher level', () => {
        expect(consolidateToLevel<ITest>({ inProgress: testTree, newLevel: 3 })).toEqual(testTree)
    })

    it('consolidates a single level', () => {
        expect(consolidateToLevel<ITest>({ inProgress: {
            levelsInProgress: [{
                item: { name: 'A' },
                children: []
            },
            {
                item: { name: 'B' },
                children: []
            }],
            rootOutput: []
        } as any, newLevel: 0 })).toEqual({ levelsInProgress: [{
                item: { name: 'A' },
                children: [{
                    item: { name: 'B' },
                    children: []
                }]
            }],
            rootOutput: []
        })
    })

    it('consolidates a sibling level', () => {
        const output = consolidateToLevel<ITest>({ inProgress: {
            levelsInProgress: [{
                item: { name: 'A' },
                children: []
            },
            {
                item: { name: 'B' },
                children: []
            },
            {
                item: { name: 'C' },
                children: []
            }] as any,
            rootOutput: []
        }, newLevel: 1 })
        expect(output).toEqual({ levelsInProgress: [{
                item: { name: 'A' },
                children: []
            },
            {
                item: { name: 'B' },
                children: [{
                    item: { name: 'C' },
                    children :[]
                }]
            }],
            rootOutput: []
        })

    })

    it('returns conslidate for lower level', () => {
        expect(consolidateToLevel<ITest>({ inProgress: testTree, newLevel: 2 })).toEqual({
            levelsInProgress: [{
                item: { name: 'A' },
                children: [{
                    item: { name: 'B' },
                    children: []
                }]
            },
            {
                item: { name: 'C' },
                children: [{
                    item: { name: 'D' },
                    children: []
                }]
            },
            {
                item: { name: 'E' },
                children: [{
                    item: { name: 'F' },
                    children: []
                }]
            }],
            rootOutput: [{
                item: { name: 'G' },
                children: [{
                    item: { name: 'H' },
                    children: []
                }]
            }]                
        })
    })

    it('returns conslidate to root', () => {
        expect(consolidateToLevel<ITest>({ inProgress: testTree, newLevel: -1 })).toEqual({
            levelsInProgress: [],
            rootOutput: [{
                item: { name: 'G' },
                children: [{
                    item: { name: 'H' },
                    children: []
                }]
            },
            {
                item: { name: 'A' },
                children: [{
                    item: { name: 'B' },
                    children: []
                },
                {
                    item: { name: 'C' },
                    children: [{
                        item: { name: 'D' },
                        children: []
                    },
                    {
                        item: { name: 'E' },
                        children: [{
                            item: { name: 'F' },
                            children: []
                        }]
                    }]
                }]
            }]
        })
    })
})

describe('flatToNested', () => {
    it('returns empty tree from empty list', () => {
        expect(flatToNested([])).toEqual([])
    })
    it('returns nesting for simple conversion', () => {
        const compare = flatToNested<ITest>([
            {
                item: { name: 'A' },
                level: 0
            },
            {
                item: { name: 'B' },
                level: 1,
            },
            {
                item: { name: 'C' },
                level: 1,
            },
            {
                item: { name: 'G' },
                level: 0
            }
        ] as any)
        expect(compare).toEqual([{
            item: { name: 'A' },
            children: [{
                item: { name: 'B' },
                children: []
            },
            {
                item: { name: 'C' },
                children: []
            }]
        },
        {
            item: { name: 'G' },
            children: []
        }])
    })
    it('returns nesting for complex conversion', () => {
        const compare = flatToNested<ITest>([
            {
                item: { name: 'A' },
                level: 0
            },
            {
                item: { name: 'B' },
                level: 1,
            },
            {
                item: { name: 'C' },
                level: 1
            },
            {
                item: { name: 'D' },
                level: 2,
            },
            {
                item: { name: 'E' },
                level: 3
            },
            {
                item: { name: 'F' },
                level: 1
            },
            {
                item: { name: 'G' },
                level: 0
            }
        ] as any)
        expect(compare).toEqual([{
            item: { name: 'A' },
            children: [{
                item: { name: 'B' },
                children: []
            },
            {
                item: { name: 'C' },
                children: [
                    {
                        item: { name: 'D' },
                        children: [
                            {
                                item: { name: 'E' },
                                children: []
                            }
                        ]
                    }
                ],
            },
            {
                item: { name: 'F' },
                children: []
            }]
        },
        {
            item: { name: 'G' },
            children: []
        }])
    })
})
