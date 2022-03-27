import wmlGrammar from '../wmlGrammar/wml.ohm-bundle.js'
import { wmlSelectorFactory } from './selector.js'

describe('wmlQuery selector', () => {

    const characterMatch = wmlGrammar.match(`
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
    let characterQuery = wmlSelectorFactory(characterMatch)

    const assetMatch = wmlGrammar.match(`
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                Test Render:
                <Link key=(123) to=(clockTower)>Clock Tower</Link>
                <Exit to=(Test)>test</Exit>
                <Exit from=(Test)>vortex</Exit>
            </Room>
            <Room key=(Test) />
            <Feature key=(clockTower)>
                Clocktower
                test
                on multiple lines
            </Feature>
        </Asset>
    `)
    let assetQuery = wmlSelectorFactory(assetMatch)

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        characterQuery = wmlSelectorFactory(characterMatch)
        assetQuery = wmlSelectorFactory(assetMatch)
    })

    it('should return empty on illegal selector', () => {
        expect(characterQuery('Fraggle Rock')).toEqual([])
    })

    it('should correctly select root node', () => {
        expect(characterQuery('Character')).toMatchSnapshot()
    })

    it('should select root node when passed empty string', () => {
        expect(characterQuery('')).toMatchSnapshot()
    })

    it('should correctly select leaf node', () => {
        expect(characterQuery('Name')).toMatchSnapshot()
    })

    it('should correctly select ancestor chain', () => {
        expect(characterQuery('Character Name')).toMatchSnapshot()
    })

    it('should select nothing on a nonmatching chain', () => {
        expect(characterQuery('Name Outfit')).toEqual([])
    })

    it('should return a list for multiple matches', () => {
        expect(assetQuery('Room')).toMatchSnapshot()
    })

    it('should correctly subset by property', () => {
        expect(assetQuery('Room[key="VORTEX"]')).toMatchSnapshot()
    })

    it('should properly chain complex predicates', () => {
        expect(assetQuery('Room[key="VORTEX"] Exit[to="Test"]')).toMatchSnapshot()
    })

    it('should properly select :first filter', () => {
        expect(assetQuery('Room Exit:first')).toMatchSnapshot()
    })
})