import wmlGrammar from '../../wmlGrammar/wml.ohm-bundle.js'
import { wmlSemantics } from '../../index.js'

describe('WML semantic prettyPrint', () => {

    it('should indent nested elements', () => {
        const match = wmlGrammar.match(`<Asset key=(Test) fileName="test"><Room key=(ABC)><Name>Vortex</Name></Room><Room key=(VORTEX) global /></Asset>`)
        expect(wmlSemantics(match).prettyPrint).toMatchSnapshot()
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
                        <Link key=(testOne) to=(clockTower)>clockTower</Link>
                        then a long enough second section that it will start testing the
                        word-wrap functionality at eighty characters, which is actually
                        quite a long line indeed, eighty characters is a lot more than
                        you might think<Link key=(testTwo) to=(clockTower)>clockTower</Link>and
                        then a third section also snuggled up to the link, to test that
                        wrapping functionality doesn't separate no-space connections.
                        Then a section with two<Link key=(testTwo) to=(clockTower)>clockTower</Link><Link key=(testTwo) to=(clockTower)>clockTower</Link>tags
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
                        One <Link key=(testOne) to=(clockTower)>clockTower</Link> two.
                        Three<Link key=(testOne) to=(clockTower)>clockTower</Link>four.
                        Five <Link key=(testOne) to=(clockTower)>clockTower</Link> <Link key=(testOne) to=(clockTower)>clockTower</Link> six.
                    </Description>
                </Room>
            </Asset>`)
        expect(wmlSemantics(match).prettyPrint).toMatchSnapshot()
    })

})