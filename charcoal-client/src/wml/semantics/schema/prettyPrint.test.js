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
                    Multi-line
                    description
                </Room>
                <Room key=(VORTEX) global />
            </Asset>`)
        expect(wmlSemantics(match).prettyPrint(0)).toMatchSnapshot()
    })
})