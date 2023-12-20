import { jest, beforeEach, describe, it, expect } from '@jest/globals'

jest.mock('./MapDThreeTree.ts')
import MapDThreeTreeRaw from './MapDThreeTree'
import { MapDThree, mapTreeTranslate } from '.'

import { mockClass } from '../../../../lib/jestHelpers'
import { GenericTree } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses'
import { MapTreeItem } from '../../Controller/baseClasses'
const MapDThreeTree = mockClass(MapDThreeTreeRaw)

describe('mapTreeTranslate', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    const reference = { tag: 'Room' as const, key: '', index: 0 }
    it('should aggregate nodes and links', () => {
        const testTree: GenericTree<MapTreeItem> = [
            { data: { tag: 'Room', key: 'Room1', x: 100, y: 100, name: [], render: [], contents: [], reference }, children: [] },
            { data: { tag: 'Room', key: 'Room2', x: 0, y: 100, name: [], render: [], contents: [], reference }, children: [
                { data: { tag: 'Exit', to: 'Room1', from: 'Room2', key: 'Room2#Room1', name: 'TestExit', contents: [] }, children: [] }
            ] }
        ]

        expect(mapTreeTranslate(testTree, [])).toEqual([{
            data: {
                nodes: [
                    { id: 'Room1', roomId: 'Room1', x: 100, y: 100, visible: true, cascadeNode: true, reference },
                    { id: 'Room2', roomId: 'Room2', x: 0, y: 100, visible: true, cascadeNode: true, reference }
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
        const testTree: GenericTree<MapTreeItem> = [
            { data: { tag: 'Room', key: 'Room1', x: 100, y: 100, name: [], render: [], contents: [], reference }, children: [] },
            { data: { tag: 'Room', key: 'Room2', x: 0, y: 100, name: [], render: [], contents: [], reference }, children: [
                { data: { tag: 'Exit', to: 'Room1', from: 'Room2', key: 'Room2#Room1', name: 'TestExit', contents: [] }, children: [] },
                { data: { tag: 'If', conditions: [], contents: [] }, children: [
                    { data: { tag: 'Exit', from: 'Room1', to: 'Room2', key: 'Room1#Room2', name: 'TestExitBack', contents: [] }, children: [] }
                ]}
            ] },
            { data: { tag: 'If', conditions: [], contents: [] }, children: [
                { data: { tag: 'Room', key: 'Room3', x: -200, y: 100, name: [], render: [], contents: [], reference }, children: [] },
                { data: { tag: 'Room', key: 'Room4', x: 200, y: 100, name: [], render: [], contents: [], reference }, children: [] }
            ]},
            { data: { tag: 'Room', key: 'Room3', x: -100, y: 100, name: [], render: [], contents: [], reference }, children: [] }
        ]

        expect(mapTreeTranslate(testTree, [])).toEqual([{
            data: {
                nodes: [
                    { id: 'Room1', roomId: 'Room1', x: 100, y: 100, visible: true, cascadeNode: true, reference },
                    { id: 'Room2', roomId: 'Room2', x: 0, y: 100, visible: true, cascadeNode: true, reference },
                    { id: 'Room3', roomId: 'Room3', x: -100, y: 100, visible: true, cascadeNode: true, reference }
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
                        visible: true,
                        key: 'Root::If-1'
                    },
                    children: []
                },
                {
                    data: {
                        nodes: [{ id: 'Room3', roomId: 'Room3', x: -200, y: 100, visible: true, cascadeNode: true, reference }, { id: 'Room4', roomId: 'Room4', x: 200, y: 100, visible: true, cascadeNode: true, reference }],
                        links: [],
                        visible: true,
                        key: 'Root::If-2'
                    },
                    children: []
                }
            ]
        }])
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
                data: {
                    tag: 'Room',
                    key: 'GHI',
                    x: 300,
                    y: 300,
                    name: [],
                    render: [],
                    contents: [],
                    reference
                },
                children: [],
            },
            {
                data: {
                    tag: 'If',
                    key: 'One',
                    conditions: [],
                    contents: []
                },
                children: [
                    {
                        data: {
                            tag: 'Room',
                            key: 'DEF',
                            x: 300,
                            y: 200,
                            name: [],
                            render: [],
                            contents: [],
                            reference
                        },
                        children: []
                    },
                    {
                        data: {
                            tag: 'Room',
                            key: 'ABC',
                            x: 200,
                            y: 200,
                            name: [],
                            render: [],
                            contents: [],
                            reference
                        },
                        children: []
                    }
                ]
            }],
            hiddenConditions: []
        })
        expect(MapDThreeTree).toHaveBeenCalledTimes(1)
        expect(MapDThreeTree.mock.calls[0]).toMatchSnapshot()

    })
})