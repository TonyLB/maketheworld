import { dbEntries } from '.'
import { schemaFromParse } from './schema'
import parse from './parser'
import tokenizer from './parser/tokenizer'
import SourceStream from './parser/tokenizer/sourceStream'
import { SchemaTag } from './schema/baseClasses'

const schemaFromString = (source: string): SchemaTag[] => {
    return schemaFromParse(parse(tokenizer(new SourceStream(source))))
}

const testSchema = schemaFromString(`
<Asset key=(Test) fileName="Test" zone="Canon">
    <Room key=(a123)>
        <Name>Vortex</Name>
        <Description>
            Hello, world!
        </Description>
        <Exit to=(b456) />
        <Exit from=(b456)>vortex</Exit>
    </Room>
    <Feature key=(clockTower)>
        <Name>Clock Tower</Name>
        <Description>
            A clock-tower of weathered grey stone looms over the area.
        </Description>
    </Feature>
    <Map key=(TestMap)>
        <Room key=(a123) x="300" y="200" />
    </Map>
    <Condition if={true}>
        <Room key=(a123)>
            <Description>
                Vortex!
            </Description>
        </Room>
    </Condition>
    <Room key=(b456)>
        <Name>Welcome</Name>
    </Room>
    <Variable key=(active) default={true} />
    <Computed key=(inactive) src={!active}>
        <Depend on=(active) />
    </Computed>
    <Action key=(toggleActive) src={active = !active} />
</Asset>
`)


const assetProps = {
    name: 'Test',
    fileName: 'test.wml',
    zone: 'Canon',
}

describe('WML dbEntries', () => {
    it('should return empty record when passed empty asset', () => {
        expect(dbEntries([])).toEqual({})
    })

    it('should serialize Rooms, Exits, Variables, Computes, and Actions', () => {
        expect(dbEntries(testSchema)).toEqual({
            'a123': {
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    name: 'Vortex',
                    render: [{
                        tag: 'String',
                        value: "Hello, world!"
                    }],
                    exits: [{
                        name: '',
                        to: "b456"
                    }],
                    spaceAfter: false,
                    spaceBefore: false    
                },
                {
                    conditions: [],
                    x: 300,
                    y: 200,
                    name: '',
                    render: [],
                    spaceAfter: false,
                    spaceBefore: false    
                },
                {
                    conditions: [{ if: 'true', dependencies: [] }],
                    name: '',
                    render: [{
                        tag: 'String',
                        value: 'Vortex!'
                    }],
                    spaceAfter: false,
                    spaceBefore: false
                }],
                global: false,
            },
            'b456': {
                tag: 'Room',
                appearances: [{
                    exits: [{
                        name: 'vortex',
                        to: 'a123',
                    }],
                    conditions: []
                },
                {
                    conditions: [],
                    name: 'Welcome',
                    render: [],
                    spaceAfter: false,
                    spaceBefore: false
                }]
            },
            clockTower: {
                tag: 'Feature',
                appearances: [{
                    conditions: [],
                    name: 'Clock Tower',
                    render: [{
                        tag: 'String',
                        value: 'A clock-tower of weathered grey stone looms over the area.'
                    }],
                    spaceAfter: false,
                    spaceBefore: false    
                }],
                global: false
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
        const testExit = schemaFromString(`
        <Asset key=(Test) fileName="Test">
            <Room key=(a123)>
                <Exit from=(b456) />
            </Room>
            <Condition if={true}>
                <Exit from=(a123) to=(b456)>welcome</Exit>
            </Condition>
        </Asset>
        `)
        const testOutput = dbEntries(testExit)
        expect(testOutput).toEqual({
            'a123': {
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    name: '',
                    render: [],
                    spaceAfter: false,
                    spaceBefore: false
                },
                {
                    conditions: [{ if: 'true', dependencies: [] }],
                    exits: [{
                        name: 'welcome',
                        to: "b456"
                    }]
                }],
                global: false
            },
            'b456': {
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    exits: [{
                        name: '',
                        to: 'a123',
                    }]
                }]
            }
        })
        const testExitTwo = schemaFromString(`
        <Asset key=(Test) fileName="Test">
            <Room key=(a123)>
                <Exit to=(a123) from=(b456)>vortex</Exit>
                <Exit to=(b456)>welcome</Exit>
            </Room>
        </Asset>
        `)
        const testOutputTwo = dbEntries(testExitTwo)
        expect(testOutputTwo).toEqual({
            'a123': {
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    exits: [{
                        to: "b456",
                        name: 'welcome',
                    }],
                    name: '',
                    render: [],
                    spaceAfter: false,
                    spaceBefore: false
                }],
                global: false
            },
            'b456': {
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    exits: [{
                        to: 'a123',
                        name: 'vortex',
                    }]
                }]
            }
        })
    })

})
