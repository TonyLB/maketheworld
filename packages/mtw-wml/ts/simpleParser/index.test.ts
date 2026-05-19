import { parse } from '.'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import { ParsePropertyTypes, ParseTypes } from './baseClasses'

describe('wml simple parser', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return empty list from no tokens', () => {
        expect(parse([])).toEqual([])
    })
    it('should parse a single tag', () => {
        const testTokens = tokenizer(new SourceStream('<Asset uuid=(Test)></Asset>'))
        expect(parse(testTokens)).toEqual([
            { type: ParseTypes.Open, tag: 'Asset', properties: [{ type: ParsePropertyTypes.Key, key: 'uuid', value: 'Test' }] },
            { type: ParseTypes.Close, tag: 'Asset' }
        ])
    })

    it('should correctly parse a top-level render tag', () => {
        const testTokens = tokenizer(new SourceStream('Test'))
        expect(parse(testTokens)).toEqual([
            { type: ParseTypes.Text, text: 'Test' }
        ])
    })
    it('should ignore whitespace outside tags', () => {
        const testTokens = tokenizer(new SourceStream('    <Asset uuid=(Test)></Asset>\n    '))
        expect(parse(testTokens)).toEqual([
            { type: ParseTypes.Open, tag: 'Asset', properties: [{ type: ParsePropertyTypes.Key, key: 'uuid', value: 'Test' }] },
            { type: ParseTypes.Close, tag: 'Asset' }
        ])
    })
    it('should parse one level of nesting', () => {
        const testTokens = tokenizer(new SourceStream('<Asset uuid=(Test)><Room key=(ABC) /></Asset>'))
        expect(parse(testTokens)).toEqual([
            { type: ParseTypes.Open, tag: 'Asset', properties: [{ type: ParsePropertyTypes.Key, key: 'uuid', value: 'Test' }] },
            { type: ParseTypes.SelfClosure, tag: 'Room', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'ABC' }] },
            { type: ParseTypes.Close, tag: 'Asset' }
        ])
    })
    it('should parse key with periods', () => {
        const testTokens = tokenizer(new SourceStream('<Asset uuid=(Test.Test)></Asset>'))
        expect(parse(testTokens)).toEqual([
            { type: ParseTypes.Open, tag: 'Asset', properties: [{ type: ParsePropertyTypes.Key, key: 'uuid', value: 'Test.Test' }] },
            { type: ParseTypes.Close, tag: 'Asset' }
        ])
    })
    it('should parse comma-separated values as AssetList', () => {
        const testTokens = tokenizer(new SourceStream('<Room origin=(ASSET#123,ASSET#456)></Room>'))
        expect(parse(testTokens)).toEqual([
            { type: ParseTypes.Open, tag: 'Room', properties: [{ type: ParsePropertyTypes.AssetList, key: 'origin', value: ['ASSET#123', 'ASSET#456'] }] },
            { type: ParseTypes.Close, tag: 'Room' }
        ])
    })
    it('should parse single origin values as Key', () => {
        const testTokens = tokenizer(new SourceStream('<Room origin=(ASSET#789)></Room>'))
        expect(parse(testTokens)).toEqual([
            { type: ParseTypes.Open, tag: 'Room', properties: [{ type: ParsePropertyTypes.Key, key: 'origin', value: 'ASSET#789' }] },
            { type: ParseTypes.Close, tag: 'Room' }
        ])
    })
    it('should reject invalid AssetUUIDs in comma-separated lists', () => {
        const testTokens = tokenizer(new SourceStream('<Room origin=(INVALID#123,ASSET#456)></Room>'))
        expect(() => parse(testTokens)).toThrow('Invalid asset list')
    })
    it('should parse elements correctly', () => {
        const testTokens = tokenizer(new SourceStream(`
            <Asset uuid=(Test) fileName="test">
                <Import from=(BASE)>
                    <Room uuid=(123) key=(ABC) />
                </Import>
                <Room key=(ABC)>
                    <Situation uuid=(123-VORTEX-example)>
                        <DisplayName>Vortex</DisplayName>
                        <Description>
                            <Space />
                            Vortex
                            <Link to=(GHI)>(knowledge)</Link>
                        </Description>
                    </Situation>
                    <Exit to=(DEF)>welcome</Exit>
                </Room>
                <Room key=(DEF)>
                    <Situation uuid=(123-Welcome-example)>
                        <DisplayName>Welcome</DisplayName>
                    </Situation>
                    <Exit to=(ABC)>vortex</Exit>
                </Room>
                <Knowledge key=(GHI)>
                    <ShortName>Learn</ShortName>
                    <Description>
                        There is so much to know!
                    </Description>
                </Knowledge>
                <Moment key=(openDoorMoment)>
                    <Message key=(openDoor)>
                        The door opens!
                        <Room key=(ABC) />
                    </Message>
                </Moment>
            </Asset>
        `))
        expect(parse(testTokens)).toEqual([
            { type: ParseTypes.Open, tag: 'Asset', properties: [{ type: ParsePropertyTypes.Key, key: 'uuid', value: 'Test' }, { type: ParsePropertyTypes.Literal, key: 'fileName', value: 'test' }] },
            { type: ParseTypes.Open, tag: 'Import', properties: [{ type: ParsePropertyTypes.Key, key: 'from', value: 'BASE'}]},
            { type: ParseTypes.SelfClosure, tag: 'Room', properties: [
                { type: ParsePropertyTypes.Key, key: 'uuid', value: '123' },
                { type: ParsePropertyTypes.Key, key: 'key', value: 'ABC' }
            ] },
            { type: ParseTypes.Close, tag: 'Import' },
            { type: ParseTypes.Open, tag: 'Room', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'ABC' }] },
            { type: ParseTypes.Open, tag: 'Situation', properties: [{ type: ParsePropertyTypes.Key, key: 'uuid', value: '123-VORTEX-example' }] },
            { type: ParseTypes.Open, tag: 'DisplayName', properties: [] },
            { type: ParseTypes.Text, text: 'Vortex' },
            { type: ParseTypes.Close, tag: 'DisplayName' },
            { type: ParseTypes.Open, tag: 'Description', properties: [] },
            { type: ParseTypes.SelfClosure, tag: 'Space', properties: [] },
            { type: ParseTypes.Text, text: ' Vortex ' },
            { type: ParseTypes.Open, tag: 'Link', properties: [{ type: ParsePropertyTypes.Key, key: 'to', value: 'GHI' }] },
            { type: ParseTypes.Text, text: '(knowledge)' },
            { type: ParseTypes.Close, tag: 'Link' },
            { type: ParseTypes.Close, tag: 'Description' },
            { type: ParseTypes.Close, tag: 'Situation' },
            { type: ParseTypes.Open, tag: 'Exit', properties: [{ type: ParsePropertyTypes.Key, key: 'to', value: 'DEF' }] },
            { type: ParseTypes.Text, text: 'welcome' },
            { type: ParseTypes.Close, tag: 'Exit' },
            { type: ParseTypes.Close, tag: 'Room' },
            { type: ParseTypes.Open, tag: 'Room', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'DEF' }] },
            { type: ParseTypes.Open, tag: 'Situation', properties: [{ type: ParsePropertyTypes.Key, key: 'uuid', value: '123-Welcome-example' }] },
            { type: ParseTypes.Open, tag: 'DisplayName', properties: [] },
            { type: ParseTypes.Text, text: 'Welcome' },
            { type: ParseTypes.Close, tag: 'DisplayName' },
            { type: ParseTypes.Close, tag: 'Situation' },
            { type: ParseTypes.Open, tag: 'Exit', properties: [{ type: ParsePropertyTypes.Key, key: 'to', value: 'ABC' }] },
            { type: ParseTypes.Text, text: 'vortex' },
            { type: ParseTypes.Close, tag: 'Exit' },
            { type: ParseTypes.Close, tag: 'Room' },
            { type: ParseTypes.Open, tag: 'Knowledge', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'GHI' }] },
            { type: ParseTypes.Open, tag: 'ShortName', properties: [] },
            { type: ParseTypes.Text, text: 'Learn' },
            { type: ParseTypes.Close, tag: 'ShortName' },
            { type: ParseTypes.Open, tag: 'Description', properties: [] },
            { type: ParseTypes.Text, text: 'There is so much to know!' },
            { type: ParseTypes.Close, tag: 'Description' },
            { type: ParseTypes.Close, tag: 'Knowledge' },
            { type: ParseTypes.Open, tag: 'Moment', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'openDoorMoment' }] },
            { type: ParseTypes.Open, tag: 'Message', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'openDoor' }] },
            { type: ParseTypes.Text, text: 'The door opens! ' },
            { type: ParseTypes.SelfClosure, tag: 'Room', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'ABC' }] },
            { type: ParseTypes.Close, tag: 'Message' },
            { type: ParseTypes.Close, tag: 'Moment' },
            { type: ParseTypes.Close, tag: 'Asset' }
        ])
    })

})