import treeToSimulation from "./treeToSimulation"

describe('treeToSimulation', () => {
    it('converts empty tree', () => {
        expect(treeToSimulation([])).toEqual([])
    })
    it('converts room layers', () => {
        expect(treeToSimulation([{
            key: 'One',
            item: {
                name: 'One',
                type: 'GROUP',
                visible: true
            },
            children: [{
                key: 'One-A',
                item: {
                    name: 'One-A',
                    type: 'ROOM',
                    roomId: 'ABC',
                    visible: true,
                    x: 200,
                    y: 200
                },
                children: []
            },
            {
                key: 'One-B',
                item: {
                    name: 'One-B',
                    type: 'ROOM',
                    roomId: 'DEF',
                    visible: true,
                    x: 300,
                    y: 200
                },
                children: []
            }]
        },
        {
            key: 'Two',
            item: {
                name: 'Two',
                type: 'GROUP',
                visible: true
            },
            children: [{
                key: 'Two-A',
                item: {
                    name: 'Two-A',
                    type: 'ROOM',
                    roomId: 'GHI',
                    visible: true,
                    x: 300,
                    y: 300,
                },
                children: []
            }]
        }])).toEqual([{
            key: 'Two',
            nodes: [{
                id: 'Two-A',
                roomId: 'GHI',
                cascadeNode: false,
                x: 300,
                y: 300,
                visible: true,
                zLevel: 1
            }],
            links: []
        },
        {
            key: 'One',
            nodes: [{
                id: 'Two-A',
                roomId: 'GHI',
                cascadeNode: true,
                x: 300,
                y: 300,
                visible: true,
                zLevel: 1
            },
            {
                id: 'One-B',
                roomId: 'DEF',
                cascadeNode: false,
                x: 300,
                y: 200,
                visible: true,
                zLevel: 0
            },
            {
                id: 'One-A',
                roomId: 'ABC',
                cascadeNode: false,
                x: 200,
                y: 200,
                visible: true,
                zLevel: 0
            }],
            links: []
        }])
    })
    it('combines exit layers', () => {
        expect(treeToSimulation([{
            key: 'One',
            item: {
                name: 'One',
                type: 'GROUP',
                visible: true
            },
            children: [{
                key: 'One-A-B',
                item: {
                    name: 'One-A-B',
                    type: 'EXIT',
                    fromRoomId: 'ABC',
                    toRoomId: 'DEF',
                    visible: true
                },
                children: []
            },
            {
                key: 'One-B-A',
                item: {
                    name: 'One-B-A',
                    type: 'EXIT',
                    visible: true,
                    fromRoomId: 'DEF',
                    toRoomId: 'ABC'
                },
                children: []
            },
            {
                key: 'Two-A-One-A',
                item: {
                    name: 'Two-A-One-A',
                    type: 'EXIT',
                    visible: true,
                    fromRoomId: 'GHI',
                    toRoomId: 'ABC'
                },
                children: []
            },
            {
                key: 'One-A-Two-A',
                item: {
                    name: 'One-A-Two-A',
                    type: 'EXIT',
                    visible: true,
                    fromRoomId: 'ABC',
                    toRoomId: 'GHI'
                },
                children: []
            },
            {
                key: 'One-A',
                item: {
                    name: 'One-A',
                    type: 'ROOM',
                    roomId: 'ABC',
                    visible: true,
                    x: 300,
                    y: 300
                },
                children: []
            },
            {
                key: 'One-B',
                item: {
                    name: 'One-B',
                    type: 'ROOM',
                    roomId: 'DEF',
                    visible: true,
                    x: 300,
                    y: 200
                },
                children: []
            }]
        },
        {
            key: 'Two',
            item: {
                name: 'Two',
                type: 'GROUP',
                visible: true
            },
            children: [{
                key: 'Two-A',
                item: {
                    name: 'Two-A',
                    type: 'ROOM',
                    roomId: 'GHI',
                    visible: true,
                    x: 300,
                    y: 400
                },
                children: []
            }]
        }])).toEqual([{
            key: 'Two',
            nodes: [{
                id: 'Two-A',
                roomId: 'GHI',
                cascadeNode: false,
                x: 300,
                y: 400,
                visible: true,
                zLevel: 1,
            }],
            links: []
        },
        {
            key: 'One',
            nodes: [{
                id: 'Two-A',
                roomId: 'GHI',
                cascadeNode: true,
                x: 300,
                y: 400,
                visible: true,
                zLevel: 1,
            },
            {
                id: 'One-B',
                roomId: 'DEF',
                cascadeNode: false,
                x: 300,
                y: 200,
                visible: true,
                zLevel: 0
            },
            {
                id: 'One-A',
                roomId: 'ABC',
                cascadeNode: false,
                x: 300,
                y: 300,
                visible: true,
                zLevel: 0
            }],
            links: [{
                id: 'One-A-Two-A',
                source: 'One-A',
                target: 'Two-A',
                visible: true
            },
            {
                id: 'Two-A-One-A',
                source: 'Two-A',
                target: 'One-A',
                visible: true
            },
            {
                id: 'One-B-A',
                source: 'One-B',
                target: 'One-A',
                visible: true
            },
            {
                id: 'One-A-B',
                source: 'One-A',
                target: 'One-B',
                visible: true
            }]
        }])
    })})