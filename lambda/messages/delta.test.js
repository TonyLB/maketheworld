const { messageAndDeltas } = require('./delta')

describe("messageAndDeltas", () => {
    const realDateNow = Date.now.bind(global.Date)

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })


    it('should add a new message', () => {

        global.Date.now = jest.fn(() => 123451234567)

        const data = messageAndDeltas({
            MessageId: '123',
            Message: 'Test',
            Target: 'CHARACTER#987'
        })
        expect(data).toEqual({
            messageWrites: [{
                    MessageId: `MESSAGE#123`,
                    DataCategory: 'Content',
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
                Message: 'Test'
            }]
        })
    })

})
