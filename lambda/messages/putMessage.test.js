const { putMessage } = require('./putMessage')
const { gqlOutput } = require('./gqlOutput')

describe("putMessage", () => {
    const realDateNow = Date.now.bind(global.Date)

    const separator = `\n        `
    const testStart = `broadcastMessage(Message: {${separator}MessageId: "123"${separator}Target: "987"${separator}CreatedTime: 123451234567${separator}`

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })

    it('should add a new world message', async () => {

        global.Date.now = jest.fn(() => 123451234567)

        const data = await putMessage({
            MessageId: '123',
            RoomId: 'ABC',
            Characters: ['987'],
            DisplayProtocol: 'World',
            WorldMessage: {
                Message: 'Test'
            }
        })
        expect(data).toEqual({
            messageWrites: [
                {
                    PutRequest: {
                        Item: {
                            MessageId: 'MESSAGE#123',
                            DataCategory: 'Content',
                            Message: 'Test',
                            DisplayProtocol: 'World',
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
                            DisplayProtocol: 'World',
                            Message: 'Test'
                        }
                    }
                }
            ],
            gqlWrites: [`${testStart}DisplayProtocol: "World"${separator}WorldMessage: { Message: "Test" }\n    }) { ${gqlOutput} }`]
        })
    })

    it('should add a new character message', async () => {

        global.Date.now = jest.fn(() => 123451234567)

        const data = await putMessage({
            MessageId: '123',
            RoomId: 'ABC',
            Characters: ['987'],
            DisplayProtocol: 'Player',
            CharacterMessage: {
                CharacterId: '456',
                Message: 'Test'
            }
        })
        expect(data).toEqual({
            messageWrites: [
                {
                    PutRequest: {
                        Item: {
                            MessageId: 'MESSAGE#123',
                            DataCategory: 'Content',
                            Message: 'Test',
                            CharacterId: '456',
                            DisplayProtocol: 'Player',
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
                            DisplayProtocol: 'Player',
                            Message: 'Test',
                            CharacterId: '456'
                        }
                    }
                }
            ],
            gqlWrites: [`${testStart}DisplayProtocol: "Player"${separator}CharacterMessage: { CharacterId: "456", Message: "Test" }\n    }) { ${gqlOutput} }`]
        })
    })

    it('should add a new direct message', async () => {

        global.Date.now = jest.fn(() => 123451234567)

        const data = await putMessage({
            MessageId: '123',
            RoomId: 'ABC',
            Characters: ['987'],
            DisplayProtocol: 'Direct',
            DirectMessage: {
                CharacterId: '456',
                Message: 'Test',
                Title: 'TestTitle',
                Recipients: ['987']
            }
        })
        expect(data).toEqual({
            messageWrites: [
                {
                    PutRequest: {
                        Item: {
                            MessageId: 'MESSAGE#123',
                            DataCategory: 'Content',
                            Message: 'Test',
                            CharacterId: '456',
                            DisplayProtocol: 'Direct',
                            Title: 'TestTitle',
                            Recipients: ['987'],
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
                            DisplayProtocol: 'Direct',
                            Message: 'Test',
                            CharacterId: '456',
                            Title: 'TestTitle',
                            Recipients: ['987']
                        }
                    }
                }
            ],
            gqlWrites: [`${testStart}DisplayProtocol: "Direct"${separator}DirectMessage: { CharacterId: "456", Message: "Test", Title: "TestTitle", Recipients: ["987"] }\n    }) { ${gqlOutput} }`]
        })
    })

    it('should add a new announce message', async () => {

        global.Date.now = jest.fn(() => 123451234567)

        const data = await putMessage({
            MessageId: '123',
            RoomId: 'ABC',
            Characters: ['987'],
            DisplayProtocol: 'Announce',
            AnnounceMessage: {
                CharacterId: '456',
                Message: 'Test',
                Title: 'TestTitle'
            }
        })
        expect(data).toEqual({
            messageWrites: [
                {
                    PutRequest: {
                        Item: {
                            MessageId: 'MESSAGE#123',
                            DataCategory: 'Content',
                            Message: 'Test',
                            CharacterId: '456',
                            DisplayProtocol: 'Announce',
                            Title: 'TestTitle',
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
                            DisplayProtocol: 'Announce',
                            Message: 'Test',
                            CharacterId: '456',
                            Title: 'TestTitle'
                        }
                    }
                }
            ],
            gqlWrites: [`${testStart}DisplayProtocol: "Announce"${separator}AnnounceMessage: { CharacterId: "456", Message: "Test", Title: "TestTitle" }\n    }) { ${gqlOutput} }`]
        })
    })

})
