const { broadcastMessages } = require('./broadcastMessages')
const { gqlOutput } = require('./gqlOutput')

const removeWhitespace = (val) => (val.split('\n').map((line) => line.trim()).join('\n'))
describe("broadcastMessages", () => {

    it('should return empty when no characters in list', () => {

        expect(broadcastMessages({
            MessageId: '123',
            Message: 'Test',
            CreatedTime: 123456,
            Characters: []
        })).toEqual([])

    })

    it('should return character updates when characters in list', () => {

        expect(broadcastMessages({
            MessageId: '123',
            Message: 'Test',
            CreatedTime: 123456,
            Characters: ['ABC', 'DEF']
        }).map((item) => (removeWhitespace(item)))).toEqual([
            `broadcastMessage(Message: {\nMessageId: "123",\nMessage: "Test",\nTarget: "ABC",\n\n\n\n\nCreatedTime: 123456\n}) {${removeWhitespace(gqlOutput)}}`,
            `broadcastMessage(Message: {\nMessageId: "123",\nMessage: "Test",\nTarget: "DEF",\n\n\n\n\nCreatedTime: 123456\n}) {${removeWhitespace(gqlOutput)}}`
        ])

    })

})

