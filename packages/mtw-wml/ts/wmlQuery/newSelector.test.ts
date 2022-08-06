import { schemaFromParse } from '../index'
import parse from '../parser/index'
import { TokenizeException } from '../parser/tokenizer/baseClasses'
import tokenizer from '../parser/tokenizer/index'
import SourceStream from '../parser/tokenizer/sourceStream'
import { isSchemaWithContents, SchemaTag } from '../schema/baseClasses'
import { newWMLSelectorFactory } from './newSelector'

describe('newWMLQuery selector', () => {

    const ignoreParse = (nodes: SchemaTag[]) => (nodes.map((node) => {
        if (isSchemaWithContents(node)) {
            const { parse, contents, ...rest } = node
            return {
                ...rest,
                contents: ignoreParse(contents)
            }
        }
        else {
            const { parse, ...rest } = node
            return rest
        }
    }))

    const characterMatch = schemaFromParse(parse(tokenizer(new SourceStream(`
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
    `))))
    let characterQuery = newWMLSelectorFactory(characterMatch)

    const assetMatch = schemaFromParse(parse(tokenizer(new SourceStream(`
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    Test Render:
                    <Link to=(clockTower)>Clock Tower</Link>
                </Description>
                <Exit to=(Test)>test</Exit>
                <Exit from=(Test)>vortex</Exit>
            </Room>
            <Room key=(Test) />
            <Feature key=(clockTower)>
                <Description>
                    Clocktower
                    test
                    on multiple lines
                </Description>
            </Feature>
        </Asset>
    `))))
    let assetQuery = newWMLSelectorFactory(assetMatch)

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        characterQuery = newWMLSelectorFactory(characterMatch)
        assetQuery = newWMLSelectorFactory(assetMatch)
    })

    it('should throw error on illegal selector', () => {
        expect(() => (characterQuery('Fraggle Rock'))).toThrow(TokenizeException)
    })

    it('should correctly select root node', () => {
        expect(ignoreParse(characterQuery('Character'))).toMatchSnapshot()
    })

    it('should select root node when passed empty string', () => {
        expect(ignoreParse(characterQuery(''))).toMatchSnapshot()
    })

    it('should correctly select leaf node', () => {
        expect(ignoreParse(characterQuery('Name'))).toMatchSnapshot()
    })

    it('should correctly select ancestor chain', () => {
        expect(ignoreParse(characterQuery('Character Name'))).toMatchSnapshot()
    })

    it('should select nothing on a nonmatching chain', () => {
        expect(ignoreParse(characterQuery('Name Outfit'))).toEqual([])
    })

    it('should return a list for multiple matches', () => {
        expect(ignoreParse(assetQuery('Room'))).toMatchSnapshot()
    })

    it('should correctly subset by property', () => {
        expect(ignoreParse(assetQuery('Room[key="VORTEX"]'))).toMatchSnapshot()
    })

    it('should properly chain complex predicates', () => {
        expect(ignoreParse(assetQuery('Room[key="VORTEX"] Exit[to="Test"]'))).toMatchSnapshot()
    })

    it('should properly select :first filter', () => {
        expect(ignoreParse(assetQuery('Room Exit:first'))).toMatchSnapshot()
    })

    it('should properly select one level :nthChild filter', () => {
        expect(ignoreParse(assetQuery('Asset:nthChild(1)'))).toMatchSnapshot()
    })

    it('should properly select nested :nthChild filters', () => {
        expect(ignoreParse(assetQuery('Asset:nthChild(0):nthChild(2)'))).toMatchSnapshot()
    })

    it('should properly select grouped operators', () => {
        expect(ignoreParse(assetQuery('(Asset Room) Description'))).toMatchSnapshot()
    })

    it('should properly select boolean or', () => {
        expect(ignoreParse(assetQuery('Asset (Room, Feature) Description'))).toMatchSnapshot()
    })

    it('should properly select boolean or of chained selectors', () => {
        expect(ignoreParse(assetQuery('Room Exit, Feature Description'))).toMatchSnapshot()
    })
})