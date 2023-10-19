import { flattenOrderedConditionalTree, mergeOrderedConditionalTrees, navigationSequence, unflattenOrderedConditionalTree } from './orderedConditionalTree'
import { SchemaConditionTag, SchemaTag } from '../../simpleSchema/baseClasses'

describe('orderedConditionalTree', () => {
    describe('flattenOrderedConditionalTree', () => {
        it('should return an empty list from an empty tree', () => {
            expect(flattenOrderedConditionalTree([])).toEqual([])
        })

        it('should flatten a nested tree', () => {
            const testTree: SchemaTag[] = [
                {
                    tag: 'If',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [
                        {
                            tag: 'If',
                            conditions: [{
                                if: 'test3',
                                not: true,
                                dependencies: ['test3']
                            },
                            {
                                if: 'test2',
                                dependencies: ['test2']
                            }],
                            contents: [{
                                tag: 'String',
                                value: 'NestedWithThreeConditions'
                            }]
                        },
                        { tag: 'String' as 'String', value: 'NestedWithOneCondition' }
                    ]
                },
                { tag: 'String', value: 'NotNested'},
                {
                    tag: 'If',
                    conditions: [{
                        if: 'test4',
                        dependencies: ['test4']
                    }],
                    contents: [{ tag: 'String', value: 'SecondNestedWithOneCondition'}]
                }
            ]
            expect(flattenOrderedConditionalTree(testTree)).toMatchSnapshot()
        })

        it('should merge adjacent items with similar conditions', () => {
            const testTree: SchemaTag[] = [
                {
                    tag: 'If',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [
                        {
                            tag: 'If',
                            conditions: [{
                                if: 'test2',
                                dependencies: ['test2']
                            }],
                            contents: [{
                                tag: 'String',
                                value: 'TestOne'
                            }]
                        }
                    ]
                },
                {
                    tag: 'If',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test']
                    },
                    {
                        if: 'test2',
                        dependencies: ['test2']
                    }],
                    contents: [
                        { tag: 'String', value: 'TestTwo'},
                        { tag: 'String', value: 'TestThree'}
                    ]
                }
            ]
            expect(flattenOrderedConditionalTree(testTree)).toMatchSnapshot()
        })

    })

    describe('unflattenOrderedConditionalTree', () => {
        it('should return an empty tree from an empty list', () => {
            expect(unflattenOrderedConditionalTree([])).toEqual([])
        })

        it('should unflatten a list', () => {
            const condition1 = {
                if: 'test',
                dependencies: ['test']
            }
            const condition2 = {
                if: 'test2',
                dependencies: ['test2']
            }
            const condition3 = {
                if: 'test3',
                dependencies: ['test3']
            }
            const testList: SchemaConditionTag[] = [
                { tag: 'If', conditions: [condition1, condition2], contents: [{ tag: 'String', value: 'TestA' }, { tag: 'String', value: 'TestB' }] },
                { tag: 'If', conditions: [condition1, condition2], contents: [{ tag: 'String', value: 'TestC' }] },
                { tag: 'If', conditions: [condition1, condition2, condition3], contents: [{ tag: 'String', value: 'TestD' }] },
                { tag: 'If', conditions: [condition1, condition3], contents: [{ tag: 'String', value: 'TestE'}] },
                { tag: 'If', conditions: [], contents: [{ tag: 'String', value: 'TestF' }] }
            ] as SchemaConditionTag[]
            expect(unflattenOrderedConditionalTree(testList)).toMatchSnapshot()
        })

        it('should collapse deep and unbranching conditional paths', () => {
            const condition1 = {
                if: 'test',
                dependencies: ['test']
            }
            const condition2 = {
                if: 'test2',
                dependencies: ['test2']
            }
            const condition3 = {
                if: 'test3',
                dependencies: ['test3']
            }
            const testList = [
                { tag: 'If', conditions: [condition1, condition2, condition3], contents: [{ tag: 'String', value: 'TestA' }, { tag: 'String', value: 'TestB' }] },
                { tag: 'If', conditions: [condition1, condition2], contents: [{ tag: 'String', value: 'TestC' }] },
                { tag: 'If', conditions: [condition1, condition2, condition3], contents: [{ tag: 'String', value: 'TestD' }] },
                { tag: 'If', conditions: [], contents: [{ tag: 'String', value: 'TestE' }] }
            ] as SchemaConditionTag[]
            expect(unflattenOrderedConditionalTree(testList)).toMatchSnapshot()
        })

    })

    describe('navigationSequence', () => {
        it('should return a traverse down and up on a single location', () => {
            expect(navigationSequence([[1, 2, 3]])).toEqual([[], [1], [1, 2], [1, 2, 3], [1, 2], [1], []])
        })
    })

    describe('mergeOrderedConditionalTrees', () => {
        it('should return unchanged on merger with empty tree', () => {
            const testTree: SchemaTag[] = [
                { tag: 'String', value: 'TestZero'},
                {
                    tag: 'If',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [{
                        tag: 'String',
                        value: 'TestOne'
                    }]
                },
                {
                    tag: 'If',
                    conditions: [{
                        if: 'test2',
                        dependencies: ['test2']
                    },
                    {
                        if: 'test',
                        dependencies: ['test']
                    }],
                    contents: [
                        { tag: 'String', value: 'TestTwo'},
                        { tag: 'String', value: 'TestThree'}
                    ]
                }
            ]
            expect(mergeOrderedConditionalTrees(testTree, [])).toEqual(testTree)
            expect(mergeOrderedConditionalTrees([], testTree)).toEqual(testTree)
        })

        it('should merge differently ordered trees', () => {
            const testTreeOne: SchemaTag[] = [
                { tag: 'String', value: 'TestZero'},
                {
                    tag: 'If',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [{
                        tag: 'String',
                        value: 'TestOne'
                    }]
                },
                {
                    tag: 'If',
                    conditions: [{
                        if: 'test2',
                        dependencies: ['test2']
                    },
                    {
                        if: 'test',
                        dependencies: ['test']
                    }],
                    contents: [
                        { tag: 'String', value: 'TestTwo'},
                        { tag: 'String', value: 'TestThree'}
                    ]
                }
            ]
            const testTreeTwo: SchemaTag[] = [
                { tag: 'String', value: 'TestFour'},
                {
                    tag: 'If',
                    conditions: [{
                        if: 'test2',
                        dependencies: ['test2']
                    }],
                    contents: [{
                        tag: 'If',
                        conditions: [{
                            if: 'test3',
                            dependencies: ['test3']
                        }],
                        contents: [{ tag: 'String', value: 'TestFive'}]
                    },
                    {
                        tag: 'If',
                        conditions: [{
                            if: 'test',
                            dependencies: ['test']
                        }],
                        contents: [{ tag: 'String', value: 'TestSix'}]

                    }]
                },
                {
                    tag: 'If',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [{
                        tag: 'String',
                        value: 'TestSeven'
                    }]
                }
            ]
            expect(mergeOrderedConditionalTrees(testTreeOne, testTreeTwo)).toMatchSnapshot()
            expect(mergeOrderedConditionalTrees(testTreeTwo, testTreeOne)).toMatchSnapshot()
        })

    })
})
