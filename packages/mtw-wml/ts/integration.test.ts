import {
    validatedSchema,
    schemaFromParse
} from '.'
import { NormalizeTagMismatchError } from './normalize'
import tokenizer from './parser/tokenizer'
import parser from './parser'
import SourceStream from './parser/tokenizer/sourceStream'
import wmlGrammar from './wmlGrammar/wml.ohm-bundle.js'

describe('parallel validateSchema integration test (temporary)', () => {
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
    console.log(`Schema: ${JSON.stringify(newSchema[0], null, 4)}`)
    expect(newSchema[0]).toEqual(schema)
})