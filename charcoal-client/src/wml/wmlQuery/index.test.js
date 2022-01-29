import wmlGrammar from '../wmlGrammar/wml.ohm-bundle'
import { wmlQueryFactory  } from './index'

describe('wmlQuery', () => {

    const match = `
        <Character key="TESS" fileName="Tess" player="TonyLB">
            // Comments should be preserved
            <Name>Tess</Name>
            <Pronouns>She/her</Pronouns>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        </Character>
    `

    let wmlQuery = null

    beforeEach(() => {
        wmlQuery = wmlQueryFactory(match)
    })

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
                start: 120,
                end: 137
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

    it('should correctly update existing prop', () => {
        expect(wmlQuery('Character').prop('key', 'Tess').source()).toEqual(`
        <Character key="Tess" fileName="Tess" player="TonyLB">
            // Comments should be preserved
            <Name>Tess</Name>
            <Pronouns>She/her</Pronouns>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        </Character>
    `)
    })

    it('should correctly remove existing prop', () => {
        expect(wmlQuery('Character').removeProp('key').source()).toEqual(`
        <Character fileName="Tess" player="TonyLB">
            // Comments should be preserved
            <Name>Tess</Name>
            <Pronouns>She/her</Pronouns>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        </Character>
    `)
    })

    it('should correctly no-op when asked to remove an absent prop', () => {
        expect(wmlQuery('Name').removeProp('key').source()).toEqual(match)
    })

    it('should return empty array contents on failed match', () => {
        expect(wmlQuery('Name Outfit').contents()).toEqual([])
    })
    it('should correctly return contents on match', () => {
        expect(wmlQuery('Character Name').contents()).toEqual(['Tess'])
    })

})