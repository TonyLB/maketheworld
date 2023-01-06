import { schemaFromParse } from '../schema'
import parse from '../parser/'
import { TokenizeException } from '../parser/tokenizer/baseClasses'
import tokenizer from '../parser/tokenizer/'
import SourceStream from '../parser/tokenizer/sourceStream'
import { isSchemaWithContents, SchemaTag } from '../schema/baseClasses'
import { wmlSelectorFactory } from './selector'
import searchParse from './search/parse'
import searchTokenizer from './search/tokenize'

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
    let characterQuery = (search: string) => (
        ignoreParse(wmlSelectorFactory(characterMatch)(searchParse(searchTokenizer(new SourceStream(search)))))
    )

    const assetMatch = schemaFromParse(parse(tokenizer(new SourceStream(`
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    Test Render:
                    <Link to=(clockTower)>Clock Tower</Link>
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
            <Room key=(Test)>
                <Exit to=(VORTEX)>vortex</Exit>
            </Room>
            <Feature key=(clockTower)>
                <Description>
                    Clocktower
                    test
                    on multiple lines
                </Description>
            </Feature>
        </Asset>
    `))))
    let assetQuery = (search: string) => (
        ignoreParse(wmlSelectorFactory(assetMatch)(searchParse(searchTokenizer(new SourceStream(search)))))
    )

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        characterQuery = (search: string) => (
            ignoreParse(wmlSelectorFactory(characterMatch)(searchParse(searchTokenizer(new SourceStream(search)))))
        )
        assetQuery = (search: string) => (
            ignoreParse(wmlSelectorFactory(assetMatch)(searchParse(searchTokenizer(new SourceStream(search)))))
        )
    })

    it('should throw error on illegal selector', () => {
        expect(() => (characterQuery('Fraggle Rock'))).toThrow(TokenizeException)
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

    it('should properly select one level :nthChild filter', () => {
        expect(assetQuery('Asset:nthChild(1)')).toMatchSnapshot()
    })

    it('should properly select nested :nthChild filters', () => {
        expect(assetQuery('Asset:nthChild(0):nthChild(1)')).toMatchSnapshot()
    })

    it('should properly select grouped operators', () => {
        expect(assetQuery('(Asset Room) Description')).toMatchSnapshot()
    })

    it('should properly select boolean or', () => {
        expect(assetQuery('Asset (Room, Feature) Description')).toMatchSnapshot()
    })

    it('should properly select boolean or of chained selectors', () => {
        expect(assetQuery('Room Exit, Feature Description')).toMatchSnapshot()
    })
})