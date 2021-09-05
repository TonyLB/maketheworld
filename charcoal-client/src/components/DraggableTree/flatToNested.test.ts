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
            name: 'A',
            children: [{
                name: 'B',
                children: []
            }]
        },
        {
            name: 'C',
            children: [{
                name: 'D',
                children: []
            }]
        },
        {
            name: 'E',
            children: []
        },
        {
            name: 'F',
            children: []
        }],
        rootOutput: [{
            name: 'G',
            children: [{
                name: 'H',
                children: []
            }]
        }]
    }

    it('returns unchanged for same or higher level', () => {
        expect(consolidateToLevel<ITest>({ inProgress: testTree, newLevel: 3 })).toEqual(testTree)
    })

    it('consolidates a single level', () => {
        expect(consolidateToLevel<ITest>({ inProgress: {
            levelsInProgress: [{
                name: 'A',
                children: []
            },
            {
                name: 'B',
                children: []
            }],
            rootOutput: []
        }, newLevel: 0 })).toEqual({ levelsInProgress: [{
                name: 'A',
                children: [{
                    name: 'B',
                    children: []
                }]
            }],
            rootOutput: []
        })
    })

    it('consolidates a sibling level', () => {
        const output = consolidateToLevel<ITest>({ inProgress: {
            levelsInProgress: [{
                name: 'A',
                children: []
            },
            {
                name: 'B',
                children: []
            },
            {
                name: 'C',
                children: []
            }],
            rootOutput: []
        }, newLevel: 1 })
        console.log(JSON.stringify(output, null, 4))
        expect(output).toEqual({ levelsInProgress: [{
                name: 'A',
                children: []
            },
            {
                name: 'B',
                children: [{
                    name: 'C',
                    children :[]
                }]
            }],
            rootOutput: []
        })

    })

    it('returns conslidate for lower level', () => {
        expect(consolidateToLevel<ITest>({ inProgress: testTree, newLevel: 2 })).toEqual({
            levelsInProgress: [{
                name: 'A',
                children: [{
                    name: 'B',
                    children: []
                }]
            },
            {
                name: 'C',
                children: [{
                    name: 'D',
                    children: []
                }]
            },
            {
                name: 'E',
                children: [{
                    name: 'F',
                    children: []
                }]
            }],
            rootOutput: [{
                name: 'G',
                children: [{
                    name: 'H',
                    children: []
                }]
            }]                
        })
    })

    it('returns conslidate to root', () => {
        expect(consolidateToLevel<ITest>({ inProgress: testTree, newLevel: -1 })).toEqual({
            levelsInProgress: [],
            rootOutput: [{
                name: 'G',
                children: [{
                    name: 'H',
                    children: []
                }]
            },
            {
                name: 'A',
                children: [{
                    name: 'B',
                    children: []
                },
                {
                    name: 'C',
                    children: [{
                        name: 'D',
                        children: []
                    },
                    {
                        name: 'E',
                        children: [{
                            name: 'F',
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
                name: 'A',
                level: 0
            },
            {
                name: 'B',
                level: 1,
            },
            {
                name: 'C',
                level: 1,
            },
            {
                name: 'G',
                level: 0
            }
        ])
        console.log(JSON.stringify(compare, null, 4))
        expect(compare).toEqual([{
            name: 'A',
            children: [{
                name: 'B',
                children: []
            },
            {
                name: 'C',
                children: []
            }]
        },
        {
            name: 'G',
            children: []
        }])
    })
    it('returns nesting for complex conversion', () => {
        const compare = flatToNested<ITest>([
            {
                name: 'A',
                level: 0
            },
            {
                name: 'B',
                level: 1,
            },
            {
                name: 'C',
                level: 1
            },
            {
                name: 'D',
                level: 2,
            },
            {
                name: 'E',
                level: 3
            },
            {
                name: 'F',
                level: 1
            },
            {
                name: 'G',
                level: 0
            }
        ])
        expect(compare).toEqual([{
            name: 'A',
            children: [{
                name: 'B',
                children: []
            },
            {
                name: 'C',
                children: [
                    { name: 'D', children: [
                        { name: 'E', children: [] }
                    ] }
                ],
            },
            {
                name: 'F',
                children: []
            }]
        },
        {
            name: 'G',
            children: []
        }])
    })
})
