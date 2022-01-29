import { wmlGrammar } from '../index'
import { wmlQueryFactory, wmlQuerySemantics } from './selector'

describe('wmlQuery selector', () => {

    const schema = wmlGrammar.match(`
        <Character key="TESS" fileName="Tess" player="TonyLB">
            <Name>Tess</Name>
            <Pronouns>She/her</Pronouns>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        </Character>
    `)
    const wmlQuery = wmlQueryFactory(schema)

    it('should return empty on empty selector', () => {
        expect(wmlQuery('')).toEqual([])
    })
})