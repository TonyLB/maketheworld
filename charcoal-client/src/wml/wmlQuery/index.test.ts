import wmlGrammar from '../wmlGrammar/wml.ohm-bundle'
import { wmlQueryFactory  } from './index'

describe('wmlQuery', () => {

    const match = `
        <Character key="TESS" fileName="Tess" player="TonyLB">
            <Name>Tess</Name>
            <Pronouns>She/her</Pronouns>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        </Character>
    `
    const wmlQuery = wmlQueryFactory(match)

    it('should return empty on illegal selector', () => {
        expect(wmlQuery('Fraggle Rock').nodes()).toEqual([])
    })

    it('should correctly query nodes', () => {
        expect(wmlQuery('Character Name').nodes()).toEqual([{
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

    it('should correctly return prop when available', () => {
        expect(wmlQuery('Character').prop('player')).toEqual('TonyLB')
    })

    it('should correctly return undefined from prop when unavailable', () => {
        expect(wmlQuery('Character').prop('origin')).toBe(undefined)
    })

    it('should correctly return undefined prop when search fails', () => {
        expect(wmlQuery('Fraggle Rock').prop('rhythm')).toBe(undefined)
    })
})