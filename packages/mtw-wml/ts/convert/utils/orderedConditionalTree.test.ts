import { FlattenedConditionalNode, flattenOrderedConditionalTree, mergeOrderedConditionalTrees, navigationSequence, OrderedConditionalTree, unflattenOrderedConditionalTree } from './orderedConditionalTree'
import { makeSchemaTag } from './index'

describe('orderedConditionalTree', () => {
    describe('flattenOrderedConditionalTree', () => {
        it('should return an empty list from an empty tree', () => {
            expect(flattenOrderedConditionalTree([])).toEqual([])
        })

        it('should flatten a nested tree', () => {
            const testTree: OrderedConditionalTree = [
                {
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [
                        {
                            conditions: [{
                                if: 'test3',
                                not: true,
                                dependencies: ['test3']
                            },
                            {
                                if: 'test2',
                                dependencies: ['test2']
                            }],
                            contents: [makeSchemaTag({
                                tag: 'String',
                                key: 'NestedWithThreeConditions'
                            })]
                        },
                        makeSchemaTag({ tag: 'String' as 'String', key: 'NestedWithOneCondition' })
                    ]
                },
                makeSchemaTag({ tag: 'String', value: 'NotNested'}),
                {
                    conditions: [{
                        if: 'test4',
                        dependencies: ['test4']
                    }],
                    contents: [makeSchemaTag({ tag: 'String', key: 'SecondNestedWithOneCondition'})]
                }
            ]
            expect(flattenOrderedConditionalTree(testTree)).toMatchSnapshot()
        })

        it('should merge adjacent items with similar conditions', () => {
            const testTree: OrderedConditionalTree = [
                {
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [
                        {
                            conditions: [{
                                if: 'test2',
                                dependencies: ['test2']
                            }],
                            contents: [makeSchemaTag({
                                tag: 'String',
                                key: 'TestOne'
                            })]
                        }
                    ]
                },
                {
                    conditions: [{
                        if: 'test',
                        dependencies: ['test']
                    },
                    {
                        if: 'test2',
                        dependencies: ['test2']
                    }],
                    contents: [
                        makeSchemaTag({ tag: 'String', key: 'TestTwo'}),
                        makeSchemaTag({ tag: 'String', key: 'TestThree'})
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
            const testList: FlattenedConditionalNode[] = [
                { conditions: [condition1, condition2], contents: [makeSchemaTag({ tag: 'String', value: 'TestA' }), makeSchemaTag({ tag: 'String', value: 'TestB' })] },
                { conditions: [condition1, condition2], contents: [makeSchemaTag({ tag: 'String', value: 'TestC' })] },
                { conditions: [condition1, condition2, condition3], contents: [makeSchemaTag({ tag: 'String', value: 'TestD' })] },
                { conditions: [condition1, condition3], contents: [makeSchemaTag({ tag: 'String', value: 'TestE'})] },
                { conditions: [], contents: [makeSchemaTag({ tag: 'String', value: 'TestF' })] }
            ]
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
            const testList: FlattenedConditionalNode[] = [
                { conditions: [condition1, condition2, condition3], contents: [makeSchemaTag({ tag: 'String', value: 'TestA' }), makeSchemaTag({ tag: 'String', value: 'TestB' })] },
                { conditions: [condition1, condition2], contents: [makeSchemaTag({ tag: 'String', value: 'TestC' })] },
                { conditions: [condition1, condition2, condition3], contents: [makeSchemaTag({ tag: 'String', value: 'TestD' })] },
                { conditions: [], contents: [makeSchemaTag({ tag: 'String', value: 'TestE' })] }
            ]
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
            const testTree: OrderedConditionalTree = [
                makeSchemaTag({ tag: 'String', key: 'TestZero'}),
                {
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [makeSchemaTag({
                        tag: 'String',
                        key: 'TestOne'
                    })]
                },
                {
                    conditions: [{
                        if: 'test2',
                        dependencies: ['test2']
                    },
                    {
                        if: 'test',
                        dependencies: ['test']
                    }],
                    contents: [
                        makeSchemaTag({ tag: 'String', key: 'TestTwo'}),
                        makeSchemaTag({ tag: 'String', key: 'TestThree'})
                    ]
                }
            ]
            expect(mergeOrderedConditionalTrees(testTree, [])).toEqual(testTree)
            expect(mergeOrderedConditionalTrees([], testTree)).toEqual(testTree)
        })
    })
})
