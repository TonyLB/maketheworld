import wmlGrammar from '../wmlGrammar/wml.ohm-bundle'
import { wmlSelectorFactory, wmlSelectorSemantics } from './selector'

describe('wmlQuery selector', () => {

    const match = wmlGrammar.match(`
        <Character key="TESS" fileName="Tess" player="TonyLB">
            <Name>Tess</Name>
            <Pronouns>She/her</Pronouns>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        </Character>
    `)
    const wmlQuery = wmlSelectorFactory(match)

    it('should return empty on illegal selector', () => {
        expect(wmlQuery('Fraggle Rock')).toEqual([])
    })

    it('should correctly select root node', () => {
        expect(wmlQuery('Character')).toEqual([{
            node: {
                tag: 'Character',
                props: {
                    key: {
                        value: 'TESS',
                        start: 20,
                        end: 30,
                        valueStart: 25,
                        valueEnd: 29
                    },
                    fileName: {
                        value: 'Tess',
                        start: 31,
                        end: 46,
                        valueStart: 41,
                        valueEnd: 45
                    },
                    player: {
                        value: 'TonyLB',
                        start: 47,
                        end: 62,
                        valueStart: 55,
                        valueEnd: 61
                    }
                },
                contents: [{
                    tag: 'Name',
                    props: {},
                    contents: ["Tess"]
                }, {
                    tag: 'Pronouns',
                    props: {},
                    contents: ["She/her"]
                }, {
                    tag: 'FirstImpression',
                    props: {},
                    contents: ["Frumpy Goth"]
                }, {
                    tag: 'OneCoolThing',
                    props: {},
                    contents: ["Fuchsia eyes"]
                }, {
                    tag: 'Outfit',
                    props: {},
                    contents: ["A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace."]
                }]
            },
            source: {
                start: 9,
                end: 380
            }
        }])
    })

    it('should correctly select leaf node', () => {
        expect(wmlQuery('Name')).toEqual([{
            node: {
                tag: 'Name',
                props: {},
                contents: ["Tess"]
            },
            source: {
                start: 76,
                end: 93
            }
        }])
    })

    it('should correctly select ancestor chain', () => {
        expect(wmlQuery('Character Name')).toEqual([{
            node: {
                tag: 'Name',
                props: {},
                contents: ["Tess"]
            },
            source: {
                start: 76,
                end: 93
            }
        }])
    })

    it('should select nothing on a nonmatching chain', () => {
        expect(wmlQuery('Name Outfit')).toEqual([])
    })
})