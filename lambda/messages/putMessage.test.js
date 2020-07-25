const { putMessage } = require('./putMessage')
const { gqlOutput } = require('./gqlOutput')

describe("putMessage", () => {
    const realDateNow = Date.now.bind(global.Date)

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })

    it('should add a new message', async () => {

        global.Date.now = jest.fn(() => 123451234567)

        const data = await putMessage({
            MessageId: '123',
            Message: 'Test',
            RoomId: 'ABC',
            Characters: ['987']
        })
        const separator = `\n        `
        expect(data).toEqual({
            messageWrites: [
                {
                    PutRequest: {
                        Item: {
                            MessageId: 'MESSAGE#123',
                            DataCategory: 'Content',
                            Message: 'Test',
                            CreatedTime: 123451234567
                        }
                    }
                },
                {
                    PutRequest: {
                        Item: {
                            MessageId: 'ROOM#ABC',
                            DataCategory: 'MESSAGE#123',
                            CreatedTime: 123451234567
                        }
                    }
                },
                {
                    PutRequest: {
                        Item: {
                            MessageId: 'CHARACTER#987',
                            DataCategory: 'MESSAGE#123',
                            CreatedTime: 123451234567
                        }
                    }
                }
            ],
            deltaWrites: [
                {
                    PutRequest: {
                        Item: {
                            Target: 'CHARACTER#987',
                            DeltaId: '123451234567::MESSAGE#123::Content',
                            RowId: 'MESSAGE#123::Content',
                            Message: 'Test'
                        }
                    }
                }
            ],
            gqlWrites: [`broadcastMessage(Message: {${separator}MessageId: "123",${separator}Message: "Test",${separator}Target: "987",${separator}${separator}${separator}${separator}${separator}CreatedTime: 123451234567\n    }) { ${gqlOutput} }`]
        })
    })

})
