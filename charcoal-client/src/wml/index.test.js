import { dbEntries } from './index.js'

describe('WML dbEntries', () => {
    it('should return empty record when passed empty asset', () => {
        expect(dbEntries({
            tag: 'Asset',
            contents: []
        })).toEqual({})
    })

    it('should serialize Rooms, Exits, Variables and Actions', () => {
        expect(dbEntries({
            tag: 'Asset',
            key: 'Test',
            contents: [{
                tag: 'Room',
                key: '123',
                name: 'Vortex',
                render: ['Hello, world!'],
                contents: [{
                    tag: 'Exit',
                    to: '456',
                    from: '123',
                    contents: [],
                    conditions: []
                },
                {
                    tag: 'Exit',
                    to: '123',
                    from: '456',
                    name: 'vortex',
                    contents: [],
                    conditions: []
                }],
                conditions: []
            },
            {
                tag: 'Condition',
                if: 'true',
                contents: [{
                    tag: 'Room',
                    key: '123',
                    render: ['Vortex!'],
                    contents: [],
                    conditions: ['true']
                }]
            },
            {
                tag: 'Room',
                key: '456',
                name: 'Welcome',
                contents: [],
                conditions: []
            },
            {
                tag: 'Variable',
                key: 'active',
                default: 'true',
                contents: []
            },
            {
                tag: 'Action',
                key: 'toggleActive',
                src: 'active = !active',
                contents: []
            }]
        })).toEqual({
            '123': {
                tag: 'Room',
                exits: [{
                    conditions: [],
                    exits: [{
                        to: "456"
                    }]
                }],
                name: [{
                    conditions: [],
                    name: 'Vortex',
                }],
                render: [{
                    conditions: [],
                    render: ["Hello, world!"]
                },
                {
                    conditions: ['true'],
                    render: ['Vortex!']
                }]
            },
            '456': {
                tag: 'Room',
                exits: [{
                    conditions: [],
                    exits: [{
                        name: 'vortex',
                        to: '123',
                    }]
                }],
                name: [{
                    conditions: [],
                    name: 'Welcome'
                }],
                render: []
            },
            active: {
                tag: 'Variable',
                default: 'true',
                contents: []
            },
            toggleActive: {
                tag: 'Action',
                src: 'active = !active',
                contents: []
            }
        })
    })
})