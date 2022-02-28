import wmlGrammar from '../wmlGrammar/wml.ohm-bundle.js'
import { wmlSelectorFactory, wmlSelectorSemantics } from './selector.js'

describe('wmlQuery selector', () => {

    const match = wmlGrammar.match(`
        <Character key=(TESS) fileName="Tess" player="TonyLB">
            <Name>Tess</Name>
            <Pronouns
                subject="she"
                object="her"
                possessive="her"
                adjective="hers"
                reflexive="herself"
            ></Pronouns>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        </Character>
    `)
    const wmlQuery = wmlSelectorFactory(match)

    const rootNode = {
        type: 'tag',
        tag: 'Character',
        tagEnd: 19,
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
            type: 'tag',
            tag: 'Name',
            tagEnd: 81,
            props: {},
            contents: [{
                type: 'string',
                value: "Tess",
                start: 82,
                end: 86
            }],
            start: 76,
            end: 93
        }, {
            type: 'tag',
            tag: 'Pronouns',
            tagEnd: 115,
            props: {
                subject: {
                    value: 'she',
                    start: 132,
                    end: 145,
                    valueStart: 141,
                    valueEnd: 144
                },
                object: {
                    value: 'her',
                    start: 162,
                    end: 174,
                    valueStart: 170,
                    valueEnd: 173
                },
                possessive: {
                    value: 'her',
                    start: 191,
                    end: 207,
                    valueStart: 203,
                    valueEnd: 206
                },
                adjective: {
                    value: 'hers',
                    start: 224,
                    end: 240,
                    valueStart: 235,
                    valueEnd: 239
                },
                reflexive: {
                    value: 'herself',
                    start: 257,
                    end: 276,
                    valueStart: 268,
                    valueEnd: 275
                }
            },
            contents: [],
            start: 106,
            end: 301
        }, {
            type: 'tag',
            tag: 'FirstImpression',
            tagEnd: 330,
            props: {},
            contents: [{
                type: 'string',
                value: "Frumpy Goth",
                start: 331,
                end: 342
            }],
            start: 314,
            end: 360
        }, {
            type: 'tag',
            tag: 'OneCoolThing',
            tagEnd: 386,
            props: {},
            contents: [{
                type: 'string',
                value: "Fuchsia eyes",
                start: 387,
                end: 399
            }],
            start: 373,
            end: 414
        }, {
            type: 'tag',
            tag: 'Outfit',
            tagEnd: 434,
            props: {},
            contents: [{
                type: 'string',
                value: "A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.",
                start: 435,
                end: 517
            }],
            start: 427,
            end: 526
        }],
        start: 9,
        end: 547
    }

    it('should return empty on illegal selector', () => {
        expect(wmlQuery('Fraggle Rock')).toEqual([])
    })

    it('should correctly select root node', () => {
        expect(wmlQuery('Character')).toEqual([rootNode])
    })

    it('should select root node when passed empty string', () => {
        expect(wmlQuery('')).toEqual([rootNode])
    })

    it('should correctly select leaf node', () => {
        expect(wmlQuery('Name')).toEqual([{
            type: 'tag',
            tag: 'Name',
            tagEnd: 81,
            props: {},
            contents: [{
                type: 'string',
                value: "Tess",
                start: 82,
                end: 86
            }],
            start: 76,
            end: 93
        }])
    })

    it('should correctly select ancestor chain', () => {
        expect(wmlQuery('Character Name')).toEqual([{
            type: 'tag',
            tag: 'Name',
            tagEnd: 81,
            props: {},
            contents: [{
                type: 'string',
                value: "Tess",
                start: 82,
                end: 86
            }],
            start: 76,
            end: 93
        }])
    })

    it('should select nothing on a nonmatching chain', () => {
        expect(wmlQuery('Name Outfit')).toEqual([])
    })
})