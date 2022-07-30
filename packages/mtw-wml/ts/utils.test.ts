import { depthFirstParseTagGenerator, transformWithContext } from './utils'
import SourceStream from './parser/tokenizer/sourceStream'
import parser from './parser'
import tokenizer from './parser/tokenizer'
import { isParseExit, isParseRoom, ParseRoomTag, ParseTag } from './parser/baseClasses'

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

describe('transformWithContext', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    
    it('should properly transform down the context tree', () => {
        const testParse: ParseTag[] = [
            {
                tag: 'Asset',
                key: 'Test',
                contents: [{
                    tag: 'Room',
                    key: 'ABC',
                    startTagToken: 0,
                    endTagToken: 0,
                    global: false,
                    contents: [{
                        tag: 'Exit',
                        to: 'DEF',
                        startTagToken: 0,
                        endTagToken: 0,
                        name: 'TestExit'
                    },
                    {
                        tag: 'Name',
                        startTagToken: 0,
                        endTagToken: 0,
                        value: 'TestRoom'
                    }]
                }],
                startTagToken: 0,
                endTagToken: 0
            }
        ]
        const testCallback = (item: ParseTag, context: ParseTag[]): ParseTag => {
            if (isParseExit(item)) {
                const closestRoomTag = context.reduceRight<ParseRoomTag | undefined>((previous, contextItem) => (previous ? previous : (isParseRoom(contextItem) ? contextItem : undefined)), undefined)
                if (closestRoomTag) {
                    const newTo = item.to || closestRoomTag.key
                    const newFrom = item.from || closestRoomTag.key
                    const newKey = item.key || `${newFrom}#${newTo}`
                    return {
                        ...item,
                        to: newTo,
                        from: newFrom,
                        key: newKey
                    }
                }
            }
            return item
        }
        expect(transformWithContext(testParse, testCallback)).toMatchSnapshot()
    })
})