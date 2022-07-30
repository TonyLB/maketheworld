import { depthFirstParseTagGenerator } from './utils'
import SourceStream from './parser/tokenizer/sourceStream'
import parser from './parser'
import tokenizer from './parser/tokenizer'

describe('depthFirstParseTagGenerator', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should properly spool out nested tags', () => {
        const tags = parser(tokenizer(new SourceStream(`
            <Story key=(Test) instance fileName="test">
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    <Description>Vortex</Description>
                </Room>
            </Story>
        `)))
        expect([...depthFirstParseTagGenerator(tags)]).toMatchSnapshot()
    })
})
