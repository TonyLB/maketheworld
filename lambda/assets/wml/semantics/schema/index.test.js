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

    it('should parse a story element', () => {
        const match = wmlGrammar.match(`
            <Story key=(Test) fileName="test">
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
})