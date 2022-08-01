import {
    validatedSchema,
    schemaFromParse
} from '.'
import tokenizer from './parser/tokenizer'
import parser from './parser'
import SourceStream from './parser/tokenizer/sourceStream'
import wmlGrammar from './wmlGrammar/wml.ohm-bundle.js'
import normalize from './normalize'

describe('parallel validateSchema integration test (temporary)', () => {
    it('should correctly validate an asset schema', () => {
        const testSource = `
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
        `
        const match = wmlGrammar.match(testSource)
        const schema = validatedSchema(match)
        const newSchema = schemaFromParse(parser(tokenizer(new SourceStream(testSource))))
        expect(newSchema[0]).toEqual(schema)
    })

    it('should correctly validate a character schema', () => {
        const testSource = `
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
        `
        const match = wmlGrammar.match(testSource)
        const schema = validatedSchema(match)
        const newSchema = schemaFromParse(parser(tokenizer(new SourceStream(testSource))))
        expect(newSchema[0]).toEqual(schema)
    })

    it('should correctly validate a map schema', () => {
        const testSource = `
            <Story key=(Test) instance fileName="test">
                <Map key=(TestMap)>
                    <Name>Test Map</Name>
                    <Image key=(ImageTest) fileURL="https://test.com/imageTest.png" />
                    <Room key=(ABC) x="200" y="150" />
                </Map>
            </Story>
        `
        const match = wmlGrammar.match(testSource)
        const schema = validatedSchema(match)
        const newSchema = schemaFromParse(parser(tokenizer(new SourceStream(testSource))))
        expect(newSchema[0]).toEqual(schema)
    })

})

xdescribe('normalize integration test (temporary)', () => {
    it('should correctly normalize an asset schema', () => {
        const testSource = `
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
        `
        const schema = schemaFromParse(parser(tokenizer(new SourceStream(testSource))))
        expect(normalize(schema[0])).toMatchSnapshot()
    })

    it('should correctly validate a character schema', () => {
        const testSource = `
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
        `
        const schema = schemaFromParse(parser(tokenizer(new SourceStream(testSource))))
        expect(normalize(schema[0])).toMatchSnapshot()
    })

    it('should correctly validate a map schema', () => {
        const testSource = `
            <Story key=(Test) instance fileName="test">
                <Map key=(TestMap)>
                    <Name>Test Map</Name>
                    <Image key=(ImageTest) fileURL="https://test.com/imageTest.png" />
                    <Room key=(ABC) x="200" y="150" />
                </Map>
            </Story>
        `
        const schema = schemaFromParse(parser(tokenizer(new SourceStream(testSource))))
        expect(normalize(schema[0])).toMatchSnapshot()
    })

})