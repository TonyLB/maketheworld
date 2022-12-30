import { flattenOrderedConditionalTree, mergeOrderedConditionalTrees, navigationSequence, unflattenOrderedConditionalTree } from './orderedConditionalTree'
import { SchemaConditionTag, SchemaTag } from '../../schema/baseClasses'

describe('orderedConditionalTree', () => {
    describe('flattenOrderedConditionalTree', () => {
        it('should return an empty list from an empty tree', () => {
            expect(flattenOrderedConditionalTree('Description')([])).toEqual([])
        })

        it('should flatten a nested tree', () => {
            const testTree: SchemaTag[] = [
                {
                    tag: 'If',
                    contextTag: 'Description',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [
                        {
                            tag: 'If',
                            contextTag: 'Description',        
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
                    contextTag: 'Description',
                    conditions: [{
                        if: 'test4',
                        dependencies: ['test4']
                    }],
                    contents: [{ tag: 'String', value: 'SecondNestedWithOneCondition'}]
                }
            ]
            expect(flattenOrderedConditionalTree('Description')(testTree)).toMatchSnapshot()
        })

        it('should merge adjacent items with similar conditions', () => {
            const testTree: SchemaTag[] = [
                {
                    tag: 'If',
                    contextTag: 'Description',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [
                        {
                            tag: 'If',
                            contextTag: 'Description',        
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
                    contextTag: 'Description',
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
            expect(flattenOrderedConditionalTree('Description')(testTree)).toMatchSnapshot()
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
                { tag: 'If', contextTag: 'Description', conditions: [condition1, condition2], contents: [{ tag: 'String', value: 'TestA' }, { tag: 'String', value: 'TestB' }] },
                { tag: 'If', contextTag: 'Description', conditions: [condition1, condition2], contents: [{ tag: 'String', value: 'TestC' }] },
                { tag: 'If', contextTag: 'Description', conditions: [condition1, condition2, condition3], contents: [{ tag: 'String', value: 'TestD' }] },
                { tag: 'If', contextTag: 'Description', conditions: [condition1, condition3], contents: [{ tag: 'String', value: 'TestE'}] },
                { tag: 'If', contextTag: 'Description', conditions: [], contents: [{ tag: 'String', value: 'TestF' }] }
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
                { tag: 'If', contextTag: 'Description', conditions: [condition1, condition2, condition3], contents: [{ tag: 'String', value: 'TestA' }, { tag: 'String', value: 'TestB' }] },
                { tag: 'If', contextTag: 'Description', conditions: [condition1, condition2], contents: [{ tag: 'String', value: 'TestC' }] },
                { tag: 'If', contextTag: 'Description', conditions: [condition1, condition2, condition3], contents: [{ tag: 'String', value: 'TestD' }] },
                { tag: 'If', contextTag: 'Description', conditions: [], contents: [{ tag: 'String', value: 'TestE' }] }
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
                    contextTag: 'Description',
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
                    contextTag: 'Description',
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
            expect(mergeOrderedConditionalTrees('Description')(testTree, [])).toEqual(testTree)
            expect(mergeOrderedConditionalTrees('Description')([], testTree)).toEqual(testTree)
        })

        it('should merge differently ordered trees', () => {
            const testTreeOne: SchemaTag[] = [
                { tag: 'String', value: 'TestZero'},
                {
                    tag: 'If',
                    contextTag: 'Description',
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
                    contextTag: 'Description',
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
                    contextTag: 'Description',
                    conditions: [{
                        if: 'test2',
                        dependencies: ['test2']
                    }],
                    contents: [{
                        tag: 'If',
                        contextTag: 'Description',
    
                        conditions: [{
                            if: 'test3',
                            dependencies: ['test3']
                        }],
                        contents: [{ tag: 'String', value: 'TestFive'}]
                    },
                    {
                        tag: 'If',
                        contextTag: 'Description',
                            conditions: [{
                            if: 'test',
                            dependencies: ['test']
                        }],
                        contents: [{ tag: 'String', value: 'TestSix'}]

                    }]
                },
                {
                    tag: 'If',
                    contextTag: 'Description',
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
            expect(mergeOrderedConditionalTrees('Description')(testTreeOne, testTreeTwo)).toMatchSnapshot()
            expect(mergeOrderedConditionalTrees('Description')(testTreeTwo, testTreeOne)).toMatchSnapshot()
        })

    })
})
