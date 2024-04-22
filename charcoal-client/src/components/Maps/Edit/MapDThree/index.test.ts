import { jest, beforeEach, describe, it, expect } from '@jest/globals'

jest.mock('./MapDThreeTree.ts')
import MapDThreeTreeRaw from './MapDThreeTree'
import { MapDThree, mapTreeTranslate } from '.'

import { mockClass } from '../../../../lib/jestHelpers'
import { GenericTree, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { MapTreeItem } from '../../Controller/baseClasses'
import { SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
const MapDThreeTree = mockClass(MapDThreeTreeRaw)

describe('mapTreeTranslate', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should aggregate nodes and links', () => {
        const testTree: GenericTree<SchemaTag, TreeId> = [
            {
                data: { tag: 'Room', key: 'Room1' },
                children: [{ data: { tag: 'Position', x: 100, y: 100 }, children: [], id: 'DEF' }],
                id: 'ABC'
            },
            {
                data: { tag: 'Room', key: 'Room2' },
                children: [
                    { data: { tag: 'Position', x: 0, y: 100 }, children: [], id: 'JKL' },
                    { data: { tag: 'Exit', to: 'Room1', from: 'Room2', key: 'Room2#Room1' }, children: [{ data: { tag: 'String', value: 'TestExit' }, children: [], id: 'QRS'}], id: 'MNO' }
                ],
                id: 'GHI'
            }
        ]

        expect(mapTreeTranslate(testTree)).toEqual([{
            data: {
                nodes: [
                    { id: 'DEF', roomId: 'Room1', x: 100, y: 100, visible: true, cascadeNode: false },
                    { id: 'JKL', roomId: 'Room2', x: 0, y: 100, visible: true, cascadeNode: false }
                ],
                links: [
                    { id: 'Room2#Room1', source: 'Room2', target: 'Room1' }
                ],
                visible: true,
                key: 'Root'
            },
            children: []
        }])
    })

    it('should nest conditionals as children of nodes and links', () => {
        const testTree = (selected: boolean): GenericTree<SchemaTag, TreeId> => ([
            {
                data: { tag: 'Room', key: 'Room1' },
                children: [
                    { data: { tag: 'Position', x: 100, y: 100 }, children: [], id: 'BCD' },
                    {
                        data: { tag: 'If' },
                        children: [{
                            data: { tag: 'Statement', if: 'true' },
                            children: [
                                { data: { tag: 'Exit', from: 'Room1', to: 'Room2', key: 'Room1#Room2' }, children: [{ data: { tag: 'String', value: 'TestExitBack' }, children: [], id: 'UUID1' }], id: 'UUID2' }
                            ],
                            id: 'If-1'
                        }],
                        id: 'UUID3'
                    }
                ],
                id: 'ABC'
            },
            { data: { tag: 'Room', key: 'Room2' }, children: [
                { data: { tag: 'Position', x: 0, y: 100 }, children: [], id: 'UUID4' },
                { data: { tag: 'Exit', to: 'Room1', from: 'Room2', key: 'Room2#Room1' }, children: [{ data: { tag: 'String', value: 'TestExt' }, children: [], id: 'UUID5' }], id: 'UUID6' },
            ], id: 'DEF' },
            {
                data: { tag: 'If' },
                children: [{
                    data: { tag: 'Statement', if: 'true', selected },
                    children: [
                        {
                            data: { tag: 'Room', key: 'Room3' },
                            children: [{ data: { tag: 'Position', x: -200, y: 100 }, children: [], id: 'YYY' }],
                            id: 'ZZZ'
                        },
                        {
                            data: { tag: 'Room', key: 'Room4' },
                            children: [{ data: { tag: 'Position', x: 200, y: 100 }, children: [], id: 'XXX' }],
                            id: 'JKL'
                        }
                    ],
                    id: 'If-2'
                }],
                id: 'UUID7'
            },
            {
                data: { tag: 'Room', key: 'Room3' },
                children: [{ data: { tag: 'Position', x: -100, y: 100 }, children: [], id: 'HIJ' }],
                id: 'GHI'
            }
        ])

        const expectedResult = (selected: boolean) => ([{
            data: {
                nodes: [
                    { id: 'BCD', roomId: 'Room1', x: 100, y: 100, visible: true, cascadeNode: false },
                    { id: 'UUID4', roomId: 'Room2', x: 0, y: 100, visible: true, cascadeNode: false },
                    { id: 'HIJ', roomId: 'Room3', x: -100, y: 100, visible: true, cascadeNode: false }
                ],
                links: [
                    { id: 'Room2#Room1', source: 'Room2', target: 'Room1' }
                ],
                visible: true,
                key: 'Root'
            },
            children: [
                {
                    data: {
                        nodes: [],
                        links: [
                            { id: 'Room1#Room2', source: 'Room1', target: 'Room2' }
                        ],
                        visible: false,
                        key: 'If-1'
                    },
                    children: []
                },
                {
                    data: {
                        nodes: [{ id: 'YYY', roomId: 'Room3', x: -200, y: 100, visible: true, cascadeNode: false }, { id: 'XXX', roomId: 'Room4', x: 200, y: 100, visible: true, cascadeNode: false }],
                        links: [],
                        visible: selected,
                        key: 'If-2'
                    },
                    children: []
                }
            ]
        }])
        expect(mapTreeTranslate(testTree(false))).toEqual(expectedResult(false))
        expect(mapTreeTranslate(testTree(true))).toEqual(expectedResult(true))
    })

})

describe('MapDThree', () => {
    const reference = { tag: 'Room' as const, key: '', index: 0 }

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should initialize stack on construction', () => {

        const testMapDThree = new MapDThree({
            tree: [{
                data: { tag: 'Room', key: 'GHI' },
                children: [{ data: { tag: 'Position', x: 300, y: 300 }, children: [], id: '' }],
                id: ''
            },
            {
                data: { tag: 'If' },
                children: [{
                    data: { tag: 'Statement', if: 'true', selected: true },
                    children: [{
                        data: { tag: 'Room', key: 'DEF' },
                        children: [{ data: { tag: 'Position', x: 300, y: 200 }, children: [], id: '' }],
                        id: ''
                    },
                    {
                        data: { tag: 'Room', key: 'ABC' },
                        children: [{ data: { tag: 'Position', x: 200, y: 200 }, children: [], id: '' }],
                        id: ''
                    }],
                    id: 'If-1'
                }],
                id: ''
            }]
        })
        expect(MapDThreeTree).toHaveBeenCalledTimes(1)
        expect(MapDThreeTree.mock.calls[0]).toMatchSnapshot()

    })
})