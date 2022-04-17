import wmlGrammar from '../../wmlGrammar/wml.ohm-bundle.js'
import { wmlSemantics } from '../../index.js'

describe('WML semantic prettyPrint', () => {

    it('should indent nested elements', () => {
        const match = wmlGrammar.match(`<Asset key=(Test) fileName="test"><Room key=(ABC)><Name>Vortex</Name></Room><Room key=(VORTEX) global /></Asset>`)
        expect(wmlSemantics(match).prettyPrint(0)).toMatchSnapshot()
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
        expect(wmlSemantics(match).prettyPrint(0)).toMatchSnapshot()
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
        expect(wmlSemantics(match).prettyPrint(0)).toMatchSnapshot()
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
        expect(wmlSemantics(match).prettyPrint(0)).toMatchSnapshot()
    })

})