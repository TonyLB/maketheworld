import wmlGrammar from '../wmlGrammar/wml.ohm-bundle.js'
import { schemaFromParse, wmlSemantics } from '..'
import prettyPrint from './prettyPrint'
import parser from '../parser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'

describe('WMLQuery prettyPrint', () => {

    const prettyPrintFromSource = (source: string): string => {
        const tokens = tokenizer(new SourceStream(source))
        const schema = schemaFromParse(parser(tokens))
        return prettyPrint({ source, schema, tokens })
    }

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()

    })

    it('should indent nested elements', () => {
        const testSource = `<Asset key=(Test) fileName="test"><Room key=(ABC)><Name>Vortex</Name></Room><Room key=(VORTEX) global /></Asset>`
        const match = wmlGrammar.match(testSource)
        const holding = wmlSemantics(match).prettyPrint
        expect(holding).toMatchSnapshot()
        expect(prettyPrintFromSource(testSource)).toEqual(holding)
    })

    it('should remove previous whitespace', () => {
        const match = wmlGrammar.match(`
            <Asset key=(Test) fileName="test">
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    <Description>
                        Multi-line
                        description
                    </Description>
                </Room>
                <Room key=(VORTEX) global />
            </Asset>`)
        expect(wmlSemantics(match).prettyPrint).toMatchSnapshot()
    })

    it('should nest props on very long tags', () => {
        const match = wmlGrammar.match(`
            <Character key=(Tess) fileName="Tess" player="testy" zone="Library">
                <Name>Tess</Name>
                <Pronouns
                    subject="ridiculously long pronoun"
                    object="ridiculously long pronoun"
                    possessive="ridiculously long pronoun"
                    adjective="ridiculously long pronoun"
                    reflexive="ridiculously long pronoun"
                />
            </Character>`)
        expect(wmlSemantics(match).prettyPrint).toMatchSnapshot()
    })

    it('should nest props on multiline expression', () => {
        const match = wmlGrammar.match(`
            <Asset key=(Test) fileName="test">
                <Action
                    key=(test)
                    src={ singleLine() }
                />
                <Action key=(test) src={
                    multiLine()
                    expressions()
                    if (true) {
                        withPreservedIndents()
                    }
                } />
            </Asset>`)
        expect(wmlSemantics(match).prettyPrint).toMatchSnapshot()
    })

    it('should word wrap descriptions', () => {
        const match = wmlGrammar.match(`
            <Asset key=(Test) fileName="test">
                <Feature key=(clockTower)>
                    <Description>
                        An old stone clock tower
                    </Description>
                </Feature>
                <Room key=(Test)>
                    <Description>
                        A short first section
                        <Link to=(clockTower)>clockTower</Link>
                        then a long enough second section that it will start testing the
                        word-wrap functionality at eighty characters, which is actually
                        quite a long line indeed, eighty characters is a lot more than
                        you might think<Link to=(clockTower)>clockTower</Link>and
                        then a third section also snuggled up to the link, to test that
                        wrapping functionality doesn't separate no-space connections.
                        Then a section with two<Link to=(clockTower)>clockTower</Link><Link to=(clockTower)>clockTower</Link>tags
                        directly adjacent.
                    </Description>
                </Room>
            </Asset>`)
        expect(wmlSemantics(match).prettyPrint).toMatchSnapshot()
    })

    it('should preserve whitespace around tags', () => {
        const match = wmlGrammar.match(`
            <Asset key=(Test) fileName="test">
                <Feature key=(clockTower)>
                    <Description>
                        An old stone clock tower
                    </Description>
                </Feature>
                <Room key=(Test)>
                    <Description>
                        One <Link to=(clockTower)>clockTower</Link> two.
                        Three<Link to=(clockTower)>clockTower</Link>four.
                        Five <Link to=(clockTower)>clockTower</Link> <Link to=(clockTower)>clockTower</Link> six.
                    </Description>
                </Room>
            </Asset>`)
        expect(wmlSemantics(match).prettyPrint).toMatchSnapshot()
    })

    it('should convert empty tag to self-closing', () => {
        const match = wmlGrammar.match(`
            <Asset key=(Test) fileName="test">
                <Feature key=(clockTower)>
                    <Name></Name>
                </Feature>
                <Room key=(Test)>
                </Room>
            </Asset>`)
        expect(wmlSemantics(match).prettyPrint).toMatchSnapshot()
    })

    it('should place line breaks on a separate line', () => {
        const match = wmlGrammar.match(`
            <Asset key=(Test) fileName="test">
                <Feature key=(clockTower)>
                    <Description>
                        An old stone clock tower
                    </Description>
                </Feature>
                <Room key=(Test)>
                    <Description>
                        One<Link to=(clockTower)>clockTower</Link><br /><Link to=(clockTower)>clockTower</Link>two.
                    </Description>
                </Room>
            </Asset>`)
        expect(wmlSemantics(match).prettyPrint).toMatchSnapshot()
    })

})