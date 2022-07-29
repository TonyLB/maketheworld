import parse from '.'
import { ParseException } from './baseClasses'
import tokenizer from './tokenizer'
import SourceStream from './tokenizer/sourceStream'

describe('wml parser', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return empty list from no tokens', () => {
        expect(parse([])).toEqual([])
    })
    it('should parse a single tag', () => {
        const testTokens = tokenizer(new SourceStream('<Asset key=(Test)></Asset>'))
        expect(parse(testTokens)).toMatchSnapshot()
    })
    it('should ignore whitespace outside tags', () => {
        const testTokens = tokenizer(new SourceStream('    <Asset key=(Test)></Asset>\n    '))
        expect(parse(testTokens)).toMatchSnapshot()
    })
    it('should parse one level of nesting', () => {
        const testTokens = tokenizer(new SourceStream('<Asset key=(Test)><Room key=(ABC) /></Asset>'))
        expect(parse(testTokens)).toMatchSnapshot()
    })
    it('should parse elements correctly', () => {
        const testTokens = tokenizer(new SourceStream(`
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
        `))
        expect(parse(testTokens)).toMatchSnapshot()
    })
    it('should error on illegal contents', () => {
        const testTokens = tokenizer(new SourceStream('<Asset key=(Test)><Link to=(ABC)>test</Link></Asset>'))
        expect(() => {
            parse(testTokens)
        }).toThrow(ParseException)
    })
    it('should parse a character tag correctly', () => {
        const testTokens = tokenizer(new SourceStream(`
            <Character key=(Tess) fileName="Tess" player="testy" zone="Library">
                <Image key=(icon) fileURL="testIcon.png" />
                <Name>Tess</Name>
                <Pronouns
                    subject="she"
                    object="her"
                    possessive="her"
                    adjective="hers"
                    reflexive="herself"
                />
            </Character>
        `))
        expect(parse(testTokens)).toMatchSnapshot()
    })
    it('should parse a story tag correctly', () => {
        const testTokens = tokenizer(new SourceStream(`
            <Story key=(Test) instance fileName="test">
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    <Description>Vortex</Description>
                </Room>
            </Story>
        `))
        expect(parse(testTokens)).toMatchSnapshot()
    })

})