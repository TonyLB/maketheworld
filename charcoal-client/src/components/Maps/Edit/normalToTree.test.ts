import normalToTree from './normalToTree'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

describe('normalToTree', () => {
    it('should convert empty cache to empty tree', () => {
        expect(normalToTree({ MapId: '123', normalForm: {}, rooms: {}, inheritedExits: [], inheritedAppearances: [] })).toMatchSnapshot()
    })

    it('should convert rooms and exits to items', () => {
        const testNormalForm: NormalForm = {
            Test: {
                key: 'Test',
                tag: 'Asset',
                appearances: [{
                    contextStack: [],
                    contents: [{
                        key: '123',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: '456',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: '789',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'TestMap',
                        tag: 'Map',
                        index: 0
                    }],
                    location: [0]
                }]
            },
            TestMap: {
                tag: 'Map',
                key: 'TestMap',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    images: [],
                    name: [],
                    rooms: [
                        {
                            conditions: [],
                            key: '123',
                            x: 200,
                            y: 150,
                            location: [0, 0, 0]
                        }
                    ],
                    contents: [{
                        tag: 'Image',
                        key: 'ImageTest',
                        index: 0
                    },
                    {
                        tag: 'Room',
                        key: '123',
                        index: 1
                    }],
                    location: [0, 0]
                }]
            },
            '123': {
                key: '123',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    name: [{ tag: 'String', value: 'Vortex' }],
                    contents: [],
                    location: [0, 1]
                },
                {
                    contextStack: [
                        { key: 'Test', tag: 'Asset', index: 0 },
                        { key: 'TestMap', tag: 'Map', index: 0 }
                    ],
                    contents: [],
                    location: [0, 0, 0]
                }]
            },
            '456': {
                key: '456',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    name: [{ tag: 'String', value: 'Welcome Room' }],
                    contents: [
                        { key: '456#123', tag: 'Exit', index: 0 },
                        { key: '456#789', tag: 'Exit', index: 0 }
                    ],
                    location: [0, 2]
                },
                {
                    contextStack: [
                        { key: 'Test', tag: 'Asset', index: 0 },
                        { key: 'TestMap', tag: 'Map', index: 0 }
                    ],
                    contents: [],
                    location: [0, 0, 1]
                }]
            },
            '456#123': {
                key: '456#123',
                tag: 'Exit',
                to: '123',
                from: '456',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: '456', tag: 'Room', index: 0 }],
                    contents: [],
                    location: [0, 2, 0]
                }]
            },
            '456#789': {
                key: '456#789',
                tag: 'Exit',
                to: '789',
                from: '456',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }, { key: '456', tag: 'Room', index: 0 }],
                    contents: [],
                    location: [0, 2, 1]
                }]
            },
            '789': {
                key: '123',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'Test', tag: 'Asset', index: 0 }],
                    name: [{ tag: 'String', value: 'None' }],
                    contents: [],
                    location: [0, 3]
                },
                {
                    contextStack: [
                        { key: 'Test', tag: 'Asset', index: 0 },
                        { key: 'TestMap', tag: 'Map', index: 0 }
                    ],
                    contents: [],
                    location: [0, 0, 2]
                }]
            },          
        }

        const roomAssetFromName = (name: string) => ({
            tag: 'Room',
            localName: [],
            defaultName: [{ tag: 'String' as 'String', value: name }],
            name: [{ tag: 'String' as 'String', value: name }],
            localRender: [],
            defaultRender: [],
            render: []
        })
        expect(normalToTree({
            MapId: 'TestMap',
            normalForm: testNormalForm,
            rooms: {
                '123': roomAssetFromName('Vortex'),
                '456': roomAssetFromName('Welcome Room'),
                '789': roomAssetFromName('None')
            },
            inheritedExits: [],
            inheritedAppearances: []
        })).toMatchSnapshot()
    })
})