import wmlGrammar from '../../wmlGrammar/wml.ohm-bundle.js'
import { wmlSemantics } from '../../index.js'

describe('WML semantic schema', () => {
    it('should parse elements properly', () => {
        const match = wmlGrammar.match(`
            <Asset key=(Test) fileName="test">
                <Import from=(BASE)>
                    <Use key=(basePower) as=(power) />
                    <Use key=(overview) />
                </Import>
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    Vortex
                    <Link key=(switchToggle) to=(toggleOpen)>(toggle)</Link>
                    <Exit from=(DEF)>vortex</Exit>
                </Room>
                <Condition if={open}>
                    <Depend on=(open) />
                    <Room key=(ABC)>
                        <Exit to=(DEF)>welcome</Exit>
                    </Room>
                </Condition>
                <Room key=(DEF)>
                    <Name>Welcome</Name>
                </Room>
                <Variable key=(open) default={false} />
                <Action key=(toggleOpen) src={open = !open} />
                <Computed key=(closed) src={!open}>
                    <Depend on=(open) />
                </Computed>
            </Asset>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toEqual({
            key: 'Test',
            tag: 'Asset',
            fileName: 'test',
            props: {},
            contents: [{
                tag: 'Import',
                from: 'BASE',
                mapping: {
                    power: 'basePower',
                    overview: 'overview'
                },
                contents: [],
                props: {}
            },
            {
                key: 'ABC',
                tag: 'Room',
                name: 'Vortex',
                global: false,
                render: [
                    'Vortex ',
                    {
                        tag: 'Link',
                        key: 'switchToggle',
                        text: '(toggle)',
                        to: 'toggleOpen',
                        props: {},
                        contents: []
                    }
                ],
                props: {},
                contents: [{
                    tag: 'Exit',
                    from: 'DEF',
                    name: 'vortex',
                    props: {},
                    contents: []
                }]
            },
            {
                tag: 'Condition',
                if: 'open',
                dependencies: ['open'],
                props: {},
                contents: [{
                    key: 'ABC',
                    tag: 'Room',
                    global: false,
                    render: [],
                    props: {},
                    contents: [{
                        tag: 'Exit',
                        to: 'DEF',
                        name: 'welcome',
                        props: {},
                        contents: []
                    }]
                }]
            },
            {
                key: 'DEF',
                tag: 'Room',
                name: 'Welcome',
                global: false,
                props: {},
                render: [],
                contents: []
            },
            {
                key: 'open',
                tag: 'Variable',
                default: 'false',
                props: {}
            },
            {
                key: 'toggleOpen',
                tag: 'Action',
                src: 'open = !open',
                props: {}
            },
            {
                key: 'closed',
                tag: 'Computed',
                dependencies: ['open'],
                src: '!open',
                props: {}
            }]
        })
    })

    it('should parse a character element', () => {
        const match = wmlGrammar.match(`
            <Character key=(Tess) fileName="Tess" player="testy" zone="Library">
                <Image key=(icon) fileURL="testIcon.png" />
                <Name>Tess</Name>
                <Pronouns
                    subject="she"
                    object="her"
                    possessive="her"
                    adjective="hers"
                    reflexive="herself"
                />
            </Character>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toEqual({
            key: 'Tess',
            tag: 'Character',
            fileName: 'Tess',
            player: "testy",
            zone: 'Library',
            Name: 'Tess',
            Pronouns: {
                subject: 'she',
                object: 'her',
                possessive: 'her',
                adjective: 'hers',
                reflexive: 'herself'
            },
            fileURL: 'testIcon.png',
            props: {},
            contents: []
        })
    })

    it('should parse a story element', () => {
        const match = wmlGrammar.match(`
            <Story key=(Test) instance fileName="test">
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    Vortex
                </Room>
            </Story>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toEqual({
            key: 'Test',
            tag: 'Asset',
            fileName: 'test',
            Story: true,
            instance: true,
            props: {},
            contents: [{
                key: 'ABC',
                tag: 'Room',
                name: 'Vortex',
                global: false,
                render: [
                    'Vortex '
                ],
                props: {},
                contents: []
            }]
        })
    })

    it('should parse feature elements', () => {
        const match = wmlGrammar.match(`
            <Story key=(Test) instance fileName="test">
                <Feature key=(clockTower)>
                    A clock-tower of weathered grey stone looms over the area.
                </Feature>
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    <Feature key=(clockTower) />
                    Vortex
                </Room>
            </Story>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toEqual({
            key: 'Test',
            tag: 'Asset',
            fileName: 'test',
            Story: true,
            instance: true,
            props: {},
            contents: [{
                key: 'clockTower',
                tag: 'Feature',
                global: false,
                props: {},
                contents: [],
                render: ['A clock-tower of weathered grey stone looms over the area. ']
            },
            {
                key: 'ABC',
                tag: 'Room',
                name: 'Vortex',
                global: false,
                render: [
                    'Vortex '
                ],
                props: {},
                contents: [{
                    key: 'clockTower',
                    tag: 'Feature',
                    global: false,
                    props: {},
                    contents: [],
                    render: []
                }]
            }]
        })
    })

    it('should parse map elements', () => {
        const match = wmlGrammar.match(`
            <Story key=(Test) instance fileName="test">
                <Map key=(TestMap)>
                    <Name>Test Map</Name>
                    <Image key=(ImageTest) fileURL="https://test.com/imageTest.png" />
                    <Room key=(ABC) x="200" y="150" />
                </Map>
            </Story>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toEqual({
            key: 'Test',
            tag: 'Asset',
            fileName: 'test',
            Story: true,
            instance: true,
            props: {},
            contents: [{
                key: 'TestMap',
                tag: 'Map',
                name: 'Test Map',
                props: {},
                rooms: {
                    ABC: {
                        x: 200,
                        y: 150
                    }
                },
                contents: [{
                    key: 'ImageTest',
                    tag: 'Image',
                    fileURL: 'https://test.com/imageTest.png',
                    props: {},
                    contents: []
                },
                {
                    key: 'ABC',
                    tag: 'Room',
                    global: false,
                    render: [],
                    props: {},
                    contents: []
                }]
            }]
        })
    })
})