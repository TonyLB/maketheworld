import { dbEntries, assetRegistryEntries } from './index.js'

const testSchema = {
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
            contents: []
        },
        {
            tag: 'Exit',
            to: '123',
            from: '456',
            name: 'vortex',
            contents: []
        }]
    },
    {
        tag: 'Condition',
        if: 'true',
        contents: [{
            tag: 'Room',
            key: '123',
            render: ['Vortex!'],
            contents: []
        }]
    },
    {
        tag: 'Room',
        key: '456',
        name: 'Welcome',
        contents: []
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
}

describe('WML dbEntries', () => {
    it('should return empty record when passed empty asset', () => {
        expect(dbEntries({
            tag: 'Asset',
            contents: []
        })).toEqual({})
    })

    it('should serialize Rooms, Exits, Variables and Actions', () => {
        expect(dbEntries(testSchema)).toEqual({
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
                default: 'true'
            },
            toggleActive: {
                tag: 'Action',
                src: 'active = !active'
            }
        })
    })

    it('should correctly place exits into rooms', () => {
        expect(dbEntries({
            tag: 'Asset',
            key: 'Test',
            contents: [{
                tag: 'Room',
                key: '123',
                contents: [{
                    tag: 'Exit',
                    from: '456',
                    contents: [],
                }],
                conditions: []
            },
            {
                tag: 'Condition',
                if: 'true',
                contents: [{
                    tag: 'Exit',
                    from: '123',
                    to: '456',
                    contents: []
                }]
            }]
        })).toEqual({
            '123': {
                tag: 'Room',
                exits: [{
                    conditions: ['true'],
                    exits: [{
                        to: "456"
                    }]
                }],
                name: [],
                render: []
            },
            '456': {
                tag: 'Room',
                exits: [{
                    conditions: [],
                    exits: [{
                        to: '123',
                    }]
                }],
                name: [],
                render: []
            }
        })
    })
})

describe('WML assetRegistryEntries', () => {
    it('should return empty record when passed empty asset', () => {
        expect(assetRegistryEntries({
            tag: 'Asset',
            key: 'Test',
            contents: []
        })).toEqual([{ tag: 'Asset', key: 'Test' }])
    })

    it('should serialize Rooms, Exits, Variables and Actions', () => {
        expect(assetRegistryEntries(testSchema)).toEqual([
            {
                tag: 'Asset',
                key: 'Test'
            },
            {
                tag: 'Room',
                key: '123',
                name: 'Vortex',
            },
            {
                tag: 'Room',
                key: '123'
            },
            {
                tag: 'Room',
                key: '456',
                name: 'Welcome'
            },
            {
                tag: 'Variable',
                key: 'active'
            },
            {
                tag: 'Action',
                key: 'toggleActive',
                src: 'active = !active'
            }
        ])
    })
})