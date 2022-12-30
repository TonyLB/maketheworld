import { flattenOrderedConditionalTree, mergeOrderedConditionalTrees, navigationSequence, unflattenOrderedConditionalTree } from './orderedConditionalTree'
import { makeSchemaTag } from './index'
import { SchemaConditionTag, SchemaTag } from '../../schema/baseClasses'

describe('orderedConditionalTree', () => {
    describe('flattenOrderedConditionalTree', () => {
        it('should return an empty list from an empty tree', () => {
            expect(flattenOrderedConditionalTree('Description')([])).toEqual([])
        })

        it('should flatten a nested tree', () => {
            const testTree: SchemaTag[] = [
                makeSchemaTag({
                    tag: 'If',
                    contextTag: 'Description',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [
                        makeSchemaTag({
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
                            contents: [makeSchemaTag({
                                tag: 'String',
                                key: 'NestedWithThreeConditions'
                            })]
                        }),
                        makeSchemaTag({ tag: 'String' as 'String', key: 'NestedWithOneCondition' })
                    ]
                }),
                makeSchemaTag({ tag: 'String', value: 'NotNested'}),
                makeSchemaTag({
                    tag: 'If',
                    contextTag: 'Description',
                    conditions: [{
                        if: 'test4',
                        dependencies: ['test4']
                    }],
                    contents: [makeSchemaTag({ tag: 'String', key: 'SecondNestedWithOneCondition'})]
                })
            ]
            expect(flattenOrderedConditionalTree('Description')(testTree)).toMatchSnapshot()
        })

        it('should merge adjacent items with similar conditions', () => {
            const testTree: SchemaTag[] = [
                makeSchemaTag({
                    tag: 'If',
                    contextTag: 'Description',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [
                        makeSchemaTag({
                            tag: 'If',
                            contextTag: 'Description',        
                            conditions: [{
                                if: 'test2',
                                dependencies: ['test2']
                            }],
                            contents: [makeSchemaTag({
                                tag: 'String',
                                key: 'TestOne'
                            })]
                        })
                    ]
                }),
                makeSchemaTag({
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
                        makeSchemaTag({ tag: 'String', key: 'TestTwo'}),
                        makeSchemaTag({ tag: 'String', key: 'TestThree'})
                    ]
                })
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
                makeSchemaTag({ tag: 'If', contextTag: 'Description', conditions: [condition1, condition2], contents: [makeSchemaTag({ tag: 'String', value: 'TestA' }), makeSchemaTag({ tag: 'String', value: 'TestB' })] }),
                makeSchemaTag({ tag: 'If', contextTag: 'Description', conditions: [condition1, condition2], contents: [makeSchemaTag({ tag: 'String', value: 'TestC' })] }),
                makeSchemaTag({ tag: 'If', contextTag: 'Description', conditions: [condition1, condition2, condition3], contents: [makeSchemaTag({ tag: 'String', value: 'TestD' })] }),
                makeSchemaTag({ tag: 'If', contextTag: 'Description', conditions: [condition1, condition3], contents: [makeSchemaTag({ tag: 'String', value: 'TestE'})] }),
                makeSchemaTag({ tag: 'If', contextTag: 'Description', conditions: [], contents: [makeSchemaTag({ tag: 'String', value: 'TestF' })] })
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
                makeSchemaTag({ tag: 'If', contextTag: 'Description', conditions: [condition1, condition2, condition3], contents: [makeSchemaTag({ tag: 'String', value: 'TestA' }), makeSchemaTag({ tag: 'String', value: 'TestB' })] }),
                makeSchemaTag({ tag: 'If', contextTag: 'Description', conditions: [condition1, condition2], contents: [makeSchemaTag({ tag: 'String', value: 'TestC' })] }),
                makeSchemaTag({ tag: 'If', contextTag: 'Description', conditions: [condition1, condition2, condition3], contents: [makeSchemaTag({ tag: 'String', value: 'TestD' })] }),
                makeSchemaTag({ tag: 'If', contextTag: 'Description', conditions: [], contents: [makeSchemaTag({ tag: 'String', value: 'TestE' })] })
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
                makeSchemaTag({ tag: 'String', key: 'TestZero'}),
                makeSchemaTag({
                    tag: 'If',
                    contextTag: 'Description',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [makeSchemaTag({
                        tag: 'String',
                        key: 'TestOne'
                    })]
                }),
                makeSchemaTag({
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
                        makeSchemaTag({ tag: 'String', key: 'TestTwo'}),
                        makeSchemaTag({ tag: 'String', key: 'TestThree'})
                    ]
                })
            ]
            expect(mergeOrderedConditionalTrees('Description')(testTree, [])).toEqual(testTree)
            expect(mergeOrderedConditionalTrees('Description')([], testTree)).toEqual(testTree)
        })

        it('should merge differently ordered trees', () => {
            const testTreeOne: SchemaTag[] = [
                makeSchemaTag({ tag: 'String', key: 'TestZero'}),
                makeSchemaTag({
                    tag: 'If',
                    contextTag: 'Description',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [makeSchemaTag({
                        tag: 'String',
                        value: 'TestOne'
                    })]
                }),
                makeSchemaTag({
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
                        makeSchemaTag({ tag: 'String', value: 'TestTwo'}),
                        makeSchemaTag({ tag: 'String', value: 'TestThree'})
                    ]
                })
            ]
            const testTreeTwo: SchemaTag[] = [
                makeSchemaTag({ tag: 'String', value: 'TestFour'}),
                makeSchemaTag({
                    tag: 'If',
                    contextTag: 'Description',
                    conditions: [{
                        if: 'test2',
                        dependencies: ['test2']
                    }],
                    contents: [makeSchemaTag({
                        tag: 'If',
                        contextTag: 'Description',
    
                        conditions: [{
                            if: 'test3',
                            dependencies: ['test3']
                        }],
                        contents: [makeSchemaTag({ tag: 'String', value: 'TestFive'})]
                    }),
                    makeSchemaTag({
                        tag: 'If',
                        contextTag: 'Description',
                            conditions: [{
                            if: 'test',
                            dependencies: ['test']
                        }],
                        contents: [makeSchemaTag({ tag: 'String', value: 'TestSix'})]

                    })]
                }),
                makeSchemaTag({
                    tag: 'If',
                    contextTag: 'Description',
                    conditions: [{
                        if: 'test',
                        dependencies: ['test'],
                    }],
                    contents: [makeSchemaTag({
                        tag: 'String',
                        value: 'TestSeven'
                    })]
                })
            ]
            expect(mergeOrderedConditionalTrees('Description')(testTreeOne, testTreeTwo)).toMatchSnapshot()
            expect(mergeOrderedConditionalTrees('Description')(testTreeTwo, testTreeOne)).toMatchSnapshot()
        })

    })
})
