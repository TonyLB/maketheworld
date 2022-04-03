import {
    dbEntries,
    validatedSchema
} from './index.js'
import { NormalizeTagMismatchError } from './normalize.js'
import wmlGrammar from './wmlGrammar/wml.ohm-bundle.js'

const testSchema = {
    tag: 'Asset',
    key: 'Test',
    name: 'Test',
    fileName: 'test.wml',
    zone: 'Canon',
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
        tag: 'Feature',
        key: 'clockTower',
        name: 'Clock Tower',
        render: ['A clock-tower of weathered grey stone looms over the area. '],
        contents: []
    },
    {
        tag: 'Map',
        key: 'TestMap',
        contents: [{
            tag: 'Room',
            key: '123',
            x: "300",
            y: "200",
            contents: []
        }],
        rooms: {
            '123': {
                x: 300,
                y: 200
            }
        }
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
        tag: 'Computed',
        key: 'inactive',
        src: '!active',
        dependencies: ['active'],
        contents: []
    },
    {
        tag: 'Action',
        key: 'toggleActive',
        src: 'active = !active',
        contents: []
    }]
}

const assetProps = {
    name: 'Test',
    fileName: 'test.wml',
    zone: 'Canon',
}

describe('WML dbEntries', () => {
    it('should return empty record when passed empty asset', () => {
        expect(dbEntries({
            tag: 'Asset',
            contents: []
        })).toEqual({})
    })

    it('should serialize Rooms, Exits, Variables, Computes, and Actions', () => {
        expect(dbEntries(testSchema)).toEqual({
            '123': {
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    name: 'Vortex',
                    render: ["Hello, world!"],
                    exits: [{
                        to: "456"
                    }]
                },
                {
                    conditions: [],
                    x: "300",
                    y: "200"
                },
                {
                    conditions: [{ if: 'true', dependencies: [] }],
                    render: ['Vortex!'],
                }]
            },
            '456': {
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    name: 'Welcome',
                    exits: [{
                        name: 'vortex',
                        to: '123',
                    }]
                }]
            },
            clockTower: {
                tag: 'Feature',
                name: 'Clock Tower',
                appearances: [{
                    conditions: [],
                    render: ['A clock-tower of weathered grey stone looms over the area. ']
                }]
            },
            active: {
                tag: 'Variable',
                default: 'true'
            },
            inactive: {
                tag: 'Computed',
                src: '!active',
                dependencies: ['active']
            },
            toggleActive: {
                tag: 'Action',
                src: 'active = !active'
            }
        })
    })

    it('should correctly place exits into rooms', () => {
        const testOutput = dbEntries({
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
        })
        expect(testOutput).toEqual({
            '123': {
                tag: 'Room',
                appearances: [{
                    conditions: []
                },
                {
                    conditions: [{ if: 'true', dependencies: [] }],
                    exits: [{
                        to: "456"
                    }]
                }]
            },
            '456': {
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    exits: [{
                        to: '123',
                    }]
                }]
            }
        })
        const testOutputTwo = dbEntries({
            tag: 'Asset',
            key: 'Test',
            contents: [{
                tag: 'Room',
                key: '123',
                contents: [{
                    tag: 'Exit',
                    to: '123',
                    from: '456',
                    name: 'vortex',
                    contents: [],
                },
                {
                    tag: 'Exit',
                    from: '123',
                    to: '456',
                    name: 'welcome',
                    contents: []
                }],
                conditions: []
            }]
        })
        expect(testOutputTwo).toEqual({
            '123': {
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    exits: [{
                        to: "456",
                        name: 'welcome',
                    }]
                }]
            },
            '456': {
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    exits: [{
                        to: '123',
                        name: 'vortex',
                    }]
                }]
            }
        })
    })
})

describe('WML validateSchema', () => {
    it('should pass a valid schema', () => {
        const match = wmlGrammar.match(`
            <Asset key=(Test) fileName="test">
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    Vortex
                    <Exit from=(DEF)>vortex</Exit>
                </Room>
                <Room key=(DEF)>
                    <Name>Welcome</Name>
                </Room>
            </Asset>
        `)
        const schema = validatedSchema(match)
        expect(schema.errors.length).toBe(0)
    })

    it('should reject mismatched tags', () => {
        const match = wmlGrammar.match(`
            <Asset key=(Test) fileName="test">
                <Room key=(ABC)>
                    Vortex
                </Room>
                <Variable key=(ABC) default={"Vortex"} />
            </Asset>
        `)
        expect(() => (validatedSchema(match))).toThrowError(new NormalizeTagMismatchError(`Key 'ABC' is used to define elements of different tags ('Room' and 'Variable')`))
    })

    it('should reject mismatched keys', () => {
        const match = wmlGrammar.match(`
            <Asset key=(Test) fileName="test">
                <Room key=(ABC)>
                    Vortex
                    <Exit to=(DEF)>welcome</Exit>
                </Room>
            </Asset>
        `)
        const schema = validatedSchema(match)
        const { errors } = schema
        expect(errors.length).toBe(1)
        expect(errors).toEqual([`To: 'DEF' is not a key in this asset.`])
    })

})