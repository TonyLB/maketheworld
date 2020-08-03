const { messageAndDeltas } = require('./delta')

describe("messageAndDeltas", () => {
    const realDateNow = Date.now.bind(global.Date)

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })


    it('should add a new world message', () => {

        global.Date.now = jest.fn(() => 123451234567)

        const data = messageAndDeltas({
            MessageId: '123',
            Target: 'CHARACTER#987',
            DisplayProtocol: 'World',
            WorldMessage: {
                Message: 'Test'
            }
        })
        expect(data).toEqual({
            messageWrites: [{
                    MessageId: `MESSAGE#123`,
                    DataCategory: 'Content',
                    DisplayProtocol: 'World',
                    Message: 'Test',
                    CreatedTime: 123451234567
                },
                {
                    MessageId: 'CHARACTER#987',
                    DataCategory: 'MESSAGE#123',
                    CreatedTime: 123451234567
                }
            ],
            deltaWrites: [{
                Target: 'CHARACTER#987',
                DeltaId: '123451234567::MESSAGE#123::Content',
                RowId: 'MESSAGE#123::Content',
                DisplayProtocol: 'World',
                Message: 'Test'
            }]
        })
    })

})
