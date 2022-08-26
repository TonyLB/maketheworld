import parse from '../parser'
import { ParseException } from '../parser/baseClasses'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'

import { schemaFromParse } from '.'

describe('schemaFromParse', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should make a schema from parse elements correctly', () => {
        const testParse = parse(tokenizer(new SourceStream(`
        <Asset key=(Test) fileName="test">
            <Import from=(BASE)>
                <Use key=(basePower) type="Variable" as=(power) />
                <Use key=(overview) type="Room" />
            </Import>
            <Room key=(ABC)>
                <Name>Vortex</Name>
                <Description>
                    Vortex
                    <Link to=(toggleOpen)>(toggle)</Link>
                </Description>
                <Exit from=(DEF)>vortex</Exit>
            </Room>
            <Condition if={open}>
                <Depend on=(open) />
                <Room key=(ABC)>
                    <Exit to=(DEF)>welcome</Exit>
                </Room>
            </Condition>
            <Room key=(DEF)>
                <Name>Welcome</Name>
            </Room>
            <Variable key=(open) default={false} />
            <Action key=(toggleOpen) src={open = !open} />
            <Computed key=(closed) src={!open}>
                <Depend on=(open) />
            </Computed>
        </Asset>
    `)))
        expect(schemaFromParse(testParse)).toMatchSnapshot()

    })

    it('should make a schema for a character correctly', () => {
        const testParse = parse(tokenizer(new SourceStream(`
        <Character key=(TESS) fileName="Tess" player="TonyLB">
        <Name>Tess</Name>
        <FirstImpression>Frumpy Goth</FirstImpression>
        <OneCoolThing>Fuchsia eyes</OneCoolThing>
        <Pronouns
            subject="she"
            object="her"
            possessive="her"
            adjective="hers"
            reflexive="herself"
        ></Pronouns>
        <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        <Image key=(testIcon) fileURL="https://musique.opus-31.fr/images/aaa.png" />
    </Character>
    `)))
        expect(schemaFromParse(testParse)).toMatchSnapshot()

    })

})