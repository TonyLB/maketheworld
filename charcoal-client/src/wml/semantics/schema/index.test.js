import wmlGrammar from '../../wmlGrammar/wml.ohm-bundle.js'
import { wmlSemantics } from '../../index.js'

describe('WML semantic schema', () => {
    it('should parse elements properly', () => {
        const match = wmlGrammar.match(`
            <Asset key=(Test) fileName="test">
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    Vortex
                    <Exit from=(DEF)>vortex</Exit>
                </Room>
                <Condition if={open}>
                    <Room key=(ABC)>
                        <Exit to=(DEF)>welcome</Exit>
                    </Room>
                </Condition>
                <Room key=(DEF)>
                    <Name>Welcome</Name>
                </Room>
                <Variable key=(open) default={false} />
                <Action key=(toggleOpen) src={open = !open} />
            </Asset>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toEqual({
            key: 'Test',
            tag: 'Asset',
            fileName: 'test',
            importMap: {},
            props: {},
            contents: [{
                key: 'ABC',
                tag: 'Room',
                name: 'Vortex',
                global: false,
                render: ['Vortex '],
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
                dependencies: [],
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
                props: {},
                contents: []
            },
            {
                key: 'toggleOpen',
                tag: 'Action',
                src: 'open = !open',
                props: {}
            }]
        })
    })
})