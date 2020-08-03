const { broadcastMessages } = require('./broadcastMessages')
const { gqlOutput } = require('./gqlOutput')

const removeWhitespace = (val) => (val.split('\n').map((line) => line.trim()).join('\n'))
describe("broadcastMessages", () => {

    it('should return empty when no characters in list', () => {

        expect(broadcastMessages({
            MessageId: '123',
            CreatedTime: 123456,
            DisplayProtocol: 'World',
            Characters: [],
            WorldMessage: {
                Message: 'Test'
            }
        })).toEqual([])

    })

    it('should return updates for World messages', () => {

        expect(broadcastMessages({
            MessageId: '123',
            CreatedTime: 123456,
            DisplayProtocol: 'World',
            Characters: ['ABC', 'DEF'],
            WorldMessage: {
                Message: 'Test'
            }
        }).map((item) => (removeWhitespace(item)))).toEqual([
            `broadcastMessage(Message: {\nMessageId: "123"\nTarget: "ABC"\nCreatedTime: 123456\nDisplayProtocol: "World"\nWorldMessage: { Message: "Test" }\n}) {${removeWhitespace(gqlOutput)}}`,
            `broadcastMessage(Message: {\nMessageId: "123"\nTarget: "DEF"\nCreatedTime: 123456\nDisplayProtocol: "World"\nWorldMessage: { Message: "Test" }\n}) {${removeWhitespace(gqlOutput)}}`
        ])

    })

    it('should return updates for Character messages', () => {

        expect(broadcastMessages({
            MessageId: '123',
            CreatedTime: 123456,
            DisplayProtocol: 'Character',
            Characters: ['ABC', 'DEF'],
            CharacterMessage: {
                CharacterId: 'GHI',
                Message: 'Test'
            }
        }).map((item) => (removeWhitespace(item)))).toEqual([
            `broadcastMessage(Message: {\nMessageId: "123"\nTarget: "ABC"\nCreatedTime: 123456\nDisplayProtocol: "Character"\nCharacterMessage: { CharacterId: "GHI", Message: "Test" }\n}) {${removeWhitespace(gqlOutput)}}`,
            `broadcastMessage(Message: {\nMessageId: "123"\nTarget: "DEF"\nCreatedTime: 123456\nDisplayProtocol: "Character"\nCharacterMessage: { CharacterId: "GHI", Message: "Test" }\n}) {${removeWhitespace(gqlOutput)}}`
        ])

    })

    it('should return updates for Direct messages', () => {

        expect(broadcastMessages({
            MessageId: '123',
            CreatedTime: 123456,
            DisplayProtocol: 'Direct',
            Characters: ['ABC', 'DEF'],
            DirectMessage: {
                CharacterId: 'GHI',
                Message: 'Test',
                Recipients: ['ABC', 'DEF']
            }
        }).map((item) => (removeWhitespace(item)))).toEqual([
            `broadcastMessage(Message: {\nMessageId: "123"\nTarget: "ABC"\nCreatedTime: 123456\nDisplayProtocol: "Direct"\nDirectMessage: { CharacterId: "GHI", Message: "Test", Recipients: ["ABC","DEF"] }\n}) {${removeWhitespace(gqlOutput)}}`,
            `broadcastMessage(Message: {\nMessageId: "123"\nTarget: "DEF"\nCreatedTime: 123456\nDisplayProtocol: "Direct"\nDirectMessage: { CharacterId: "GHI", Message: "Test", Recipients: ["ABC","DEF"] }\n}) {${removeWhitespace(gqlOutput)}}`
        ])

    })

    it('should return updates for Announce messages', () => {

        expect(broadcastMessages({
            MessageId: '123',
            CreatedTime: 123456,
            DisplayProtocol: 'Announce',
            Characters: ['ABC', 'DEF'],
            AnnounceMessage: {
                CharacterId: 'GHI',
                Message: 'Test',
                Title: 'TestTitle'
            }
        }).map((item) => (removeWhitespace(item)))).toEqual([
            `broadcastMessage(Message: {\nMessageId: "123"\nTarget: "ABC"\nCreatedTime: 123456\nDisplayProtocol: "Announce"\nAnnounceMessage: { CharacterId: "GHI", Message: "Test", Title: "TestTitle" }\n}) {${removeWhitespace(gqlOutput)}}`,
            `broadcastMessage(Message: {\nMessageId: "123"\nTarget: "DEF"\nCreatedTime: 123456\nDisplayProtocol: "Announce"\nAnnounceMessage: { CharacterId: "GHI", Message: "Test", Title: "TestTitle" }\n}) {${removeWhitespace(gqlOutput)}}`
        ])

    })


})

