import {
    dbEntries,
    assetRegistryEntries,
    validatedSchema
} from './index.js'
import { NormalizeTagMismatchError } from './normalize.js'
import wmlGrammar from './wmlGrammar/wml.ohm-bundle.js'

const testSchema = {
    tag: 'Asset',
    key: 'Test',
    name: 'Test',
    fileName: 'test.wml',
    importMap: {},
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

const assetProps = {
    name: 'Test',
    fileName: 'test.wml',
    importMap: {},
    zone: 'Canon',
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
                tag: 'Room',
                key: '123'
            },
            {
                tag: 'Room',
                key: '456',
            },
            {
                tag: 'Asset',
                key: 'Test',
                ...assetProps
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