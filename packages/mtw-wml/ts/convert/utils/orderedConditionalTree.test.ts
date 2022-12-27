import { flattenOrderedConditionalTree, OrderedConditionalTree } from './orderedConditionalTree'
import { makeSchemaTag } from './index'
import { SchemaTag } from '../../schema/baseClasses'

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
})
