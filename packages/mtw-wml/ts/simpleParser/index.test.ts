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
        const testTokens = tokenizer(new SourceStream('<Asset key=(Test)></Asset>'))
        expect(parse(testTokens)).toEqual([
            { type: ParseTypes.Open, tag: 'Asset', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'Test' }] },
            { type: ParseTypes.Close, tag: 'Asset' }
        ])
    })
    it('should ignore whitespace outside tags', () => {
        const testTokens = tokenizer(new SourceStream('    <Asset key=(Test)></Asset>\n    '))
        expect(parse(testTokens)).toEqual([
            { type: ParseTypes.Open, tag: 'Asset', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'Test' }] },
            { type: ParseTypes.Close, tag: 'Asset' }
        ])
    })
    it('should parse one level of nesting', () => {
        const testTokens = tokenizer(new SourceStream('<Asset key=(Test)><Room key=(ABC) /></Asset>'))
        expect(parse(testTokens)).toEqual([
            { type: ParseTypes.Open, tag: 'Asset', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'Test' }] },
            { type: ParseTypes.SelfClosure, tag: 'Room', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'ABC' }] },
            { type: ParseTypes.Close, tag: 'Asset' }
        ])
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
                        <Space />
                        Vortex
                        <Link to=(toggleOpen)>(toggle)</Link>
                    </Description>
                </Room>
                <If {open}>
                    <Room key=(ABC)>
                        <Exit to=(DEF)>welcome</Exit>
                    </Room>
                </If>
                <Room key=(DEF)>
                    <Name>Welcome</Name>
                    <Exit to=(ABC)>vortex</Exit>
                </Room>
                <Knowledge key=(GHI)>
                    <Name>Learn</Name>
                    <Description>
                        There is so much to know!
                    </Description>
                </Knowledge>
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
        `))
        expect(parse(testTokens)).toEqual([
            { type: ParseTypes.Open, tag: 'Asset', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'Test' }, { type: ParsePropertyTypes.Literal, key: 'fileName', value: 'test' }] },
            { type: ParseTypes.Open, tag: 'Import', properties: [{ type: ParsePropertyTypes.Key, key: 'from', value: 'BASE'}]},
            { type: ParseTypes.SelfClosure, tag: 'Use', properties: [
                { type: ParsePropertyTypes.Key, key: 'key', value: 'basePower' },
                { type: ParsePropertyTypes.Literal, key: 'type', value: 'Variable' },
                { type: ParsePropertyTypes.Key, key: 'as', value: 'power' }
            ] },
            { type: ParseTypes.SelfClosure, tag: 'Use', properties: [
                { type: ParsePropertyTypes.Key, key: 'key', value: 'overview' },
                { type: ParsePropertyTypes.Literal, key: 'type', value: 'Room' }
            ] },
            { type: ParseTypes.Close, tag: 'Import' },
            { type: ParseTypes.Open, tag: 'Room', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'ABC' }] },
            { type: ParseTypes.Open, tag: 'Name', properties: [] },
            { type: ParseTypes.Text, text: 'Vortex' },
            { type: ParseTypes.Close, tag: 'Name' },
            { type: ParseTypes.Open, tag: 'Description', properties: [] },
            { type: ParseTypes.SelfClosure, tag: 'Space', properties: [] },
            { type: ParseTypes.Text, text: ' Vortex ' },
            { type: ParseTypes.Open, tag: 'Link', properties: [{ type: ParsePropertyTypes.Key, key: 'to', value: 'toggleOpen' }] },
            { type: ParseTypes.Text, text: '(toggle)' },
            { type: ParseTypes.Close, tag: 'Link' },
            { type: ParseTypes.Close, tag: 'Description' },
            { type: ParseTypes.Close, tag: 'Room' },
            { type: ParseTypes.Open, tag: 'If', properties: [{ type: ParsePropertyTypes.Expression, value: 'open' }] },
            { type: ParseTypes.Open, tag: 'Room', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'ABC' }] },
            { type: ParseTypes.Open, tag: 'Exit', properties: [{ type: ParsePropertyTypes.Key, key: 'to', value: 'DEF' }] },
            { type: ParseTypes.Text, text: 'welcome' },
            { type: ParseTypes.Close, tag: 'Exit' },
            { type: ParseTypes.Close, tag: 'Room' },
            { type: ParseTypes.Close, tag: 'If' },
            { type: ParseTypes.Open, tag: 'Room', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'DEF' }] },
            { type: ParseTypes.Open, tag: 'Name', properties: [] },
            { type: ParseTypes.Text, text: 'Welcome' },
            { type: ParseTypes.Close, tag: 'Name' },
            { type: ParseTypes.Open, tag: 'Exit', properties: [{ type: ParsePropertyTypes.Key, key: 'to', value: 'ABC' }] },
            { type: ParseTypes.Text, text: 'vortex' },
            { type: ParseTypes.Close, tag: 'Exit' },
            { type: ParseTypes.Close, tag: 'Room' },
            { type: ParseTypes.Open, tag: 'Knowledge', properties: [{ type: ParsePropertyTypes.Key, key: 'key', value: 'GHI' }] },
            { type: ParseTypes.Open, tag: 'Name', properties: [] },
            { type: ParseTypes.Text, text: 'Learn' },
            { type: ParseTypes.Close, tag: 'Name' },
            { type: ParseTypes.Open, tag: 'Description', properties: [] },
            { type: ParseTypes.Text, text: 'There is so much to know!' },
            { type: ParseTypes.Close, tag: 'Description' },
            { type: ParseTypes.Close, tag: 'Knowledge' },
            { type: ParseTypes.SelfClosure, tag: 'Variable', properties: [
                { type: ParsePropertyTypes.Key, key: 'key', value: 'open' },
                { type: ParsePropertyTypes.Expression, key: 'default', value: 'false' }
            ] },
            { type: ParseTypes.SelfClosure, tag: 'Action', properties: [
                { type: ParsePropertyTypes.Key, key: 'key', value: 'toggleOpen' },
                { type: ParsePropertyTypes.Expression, key: 'src', value: 'open = !open' }
            ] },
            { type: ParseTypes.SelfClosure, tag: 'Computed', properties: [
                { type: ParsePropertyTypes.Key, key: 'key', value: 'closed' },
                { type: ParsePropertyTypes.Expression, key: 'src', value: '!open' }
            ] },
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