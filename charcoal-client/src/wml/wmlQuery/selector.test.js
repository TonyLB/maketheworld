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
            type: 'tag',
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
                type: 'tag',
                tag: 'Name',
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
                props: {},
                contents: [{
                    type: 'string',
                    value: "She/her",
                    start: 116,
                    end: 123
                }],
                start: 106,
                end: 134
            }, {
                type: 'tag',
                tag: 'FirstImpression',
                props: {},
                contents: [{
                    type: 'string',
                    value: "Frumpy Goth",
                    start: 164,
                    end: 175
                }],
                start: 147,
                end: 193
            }, {
                type: 'tag',
                tag: 'OneCoolThing',
                props: {},
                contents: [{
                    type: 'string',
                    value: "Fuchsia eyes",
                    start: 220,
                    end: 232
                }],
                start: 206,
                end: 247
            }, {
                type: 'tag',
                tag: 'Outfit',
                props: {},
                contents: [{
                    type: 'string',
                    value: "A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.",
                    start: 268,
                    end: 350
                }],
                start: 260,
                end: 359
            }],
            start: 9,
            end: 380
        }])
    })

    it('should select root node when passed empty string', () => {
        expect(wmlQuery('')).toEqual([{
            type: 'tag',
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
                type: 'tag',
                tag: 'Name',
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
                props: {},
                contents: [{
                    type: 'string',
                    value: "She/her",
                    start: 116,
                    end: 123
                }],
                start: 106,
                end: 134
            }, {
                type: 'tag',
                tag: 'FirstImpression',
                props: {},
                contents: [{
                    type: 'string',
                    value: "Frumpy Goth",
                    start: 164,
                    end: 175
                }],
                start: 147,
                end: 193
            }, {
                type: 'tag',
                tag: 'OneCoolThing',
                props: {},
                contents: [{
                    type: 'string',
                    value: "Fuchsia eyes",
                    start: 220,
                    end: 232
                }],
                start: 206,
                end: 247
            }, {
                type: 'tag',
                tag: 'Outfit',
                props: {},
                contents: [{
                    type: 'string',
                    value: "A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.",
                    start: 268,
                    end: 350
                }],
                start: 260,
                end: 359
            }],
            start: 9,
            end: 380
        }])
    })

    it('should correctly select leaf node', () => {
        expect(wmlQuery('Name')).toEqual([{
            type: 'tag',
            tag: 'Name',
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