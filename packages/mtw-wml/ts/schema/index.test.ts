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
                    <Space />
                    Vortex<If {open}>
                        : Open
                    </If><ElseIf {!closed}>
                        : Indeterminate
                    </ElseIf><Else>
                        : Closed
                    </Else>
                    <Link to=(toggleOpen)>(toggle)</Link>
                </Description>
                <Exit from=(DEF)>vortex</Exit>
            </Room>
            <If {open}>
                <Room key=(ABC)>
                    <Exit to=(DEF)>welcome</Exit>
                </Room>
            </If>
            <Room key=(DEF)>
                <Name>Welcome</Name>
            </Room>
            <Variable key=(open) default={false} />
            <Action key=(toggleOpen) src={open = !open} />
            <Computed key=(closed) src={!open} />
            <Moment key=(openDoorMoment)>
                <Message key=(openDoor)>
                    The door opens!
                    <Room key=(ABC) />
                </Message>
            </Moment>
        </Asset>
    `)))
        expect(schemaFromParse(testParse)).toMatchSnapshot()

    })

    it('should combine conditional elements at every level', () => {
        const testParse = parse(tokenizer(new SourceStream(`
        <Asset key=(Test) fileName="test">
            <Room key=(ABC)>
                <Description>
                    Test One
                    <If {open}>Test Two</If>
                </Description>
                <If {open}>
                    <Description>
                        Test Three
                    </Description>
                </If>
            </Room>
            <If {open}>
                <Room key=(ABC)>
                    <Description>Test Four</Description>
                </Room>
            </If>
            <Variable key=(open) default={false} />
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
        <Image key=(testIcon) />
    </Character>
    `)))
        expect(schemaFromParse(testParse)).toMatchSnapshot()

    })

    it('should correctly extract map rooms', () => {
        const testParse = parse(tokenizer(new SourceStream(`
        <Asset key=(Test) fileName="test">
            <Map key=(testMap)>
                <Room key=(ABC) x="100" y="0" />
                <If {open}>
                    <Room key=(DEF) x="-100" y="0" />
                </If>
            </Map>
            <Variable key=(open) default={false} />
        </Asset>
    `)))
        expect(schemaFromParse(testParse)).toMatchSnapshot()

    })

    it('should correctly schematize bookmarks', () => {
        const testParse = parse(tokenizer(new SourceStream(`
        <Story key=(Test) instance fileName="test">
            <Bookmark key=(postFix)>
                <Space />(awesome!)
            </Bookmark>
            <Room key=(ABC)>
                <Name>Vortex</Name>
                <Description>Vortex<Bookmark key=(postFix) /></Description>
            </Room>
        </Story>
    `)))
        expect(schemaFromParse(testParse)).toMatchSnapshot()

    })

})