const { putMessage } = require('./putMessage')
jest.mock('@aws-sdk/util-dynamodb')
const { marshall } = require('@aws-sdk/util-dynamodb')

describe("putMessage", () => {

    beforeEach(() => {
        marshall.mockImplementation((record) => (Object.entries(record).filter(([_, value]) => (value !== undefined)).reduce((previous, [key, value]) => ({ ...previous, [key]: value }), {})))
    })

    it('should add a new world message', async () => {

        const data = await putMessage({
            MessageId: '123',
            CreatedTime: 123451234567,
            Targets: ['CHARACTER#987', 'ROOM#ABC'],
            DisplayProtocol: 'World',
            Message: 'Test'
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
                            MessageId: 'CHARACTER#987',
                            DataCategory: 'MESSAGE#123',
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
            ]
        })
    })

    it('should add a new character message', async () => {

        const data = await putMessage({
            MessageId: '123',
            CreatedTime: 123451234567,
            Targets: ['CHARACTER#987', 'ROOM#ABC'],
            DisplayProtocol: 'Player',
            CharacterId: '456',
            Message: 'Test'
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
                            MessageId: 'CHARACTER#987',
                            DataCategory: 'MESSAGE#123',
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
            ]
        })
    })

    it('should add a new direct message', async () => {

        const data = await putMessage({
            MessageId: '123',
            CreatedTime: 123451234567,
            Targets: ['CHARACTER#987', 'ROOM#ABC'],
            DisplayProtocol: 'Direct',
            CharacterId: '456',
            Message: 'Test',
            Title: 'TestTitle',
            Recipients: ['987']
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
                            MessageId: 'CHARACTER#987',
                            DataCategory: 'MESSAGE#123',
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
            ]
        })
    })

    it('should add a new announce message', async () => {

        const data = await putMessage({
            MessageId: '123',
            CreatedTime: 123451234567,
            Targets: ['CHARACTER#987', 'ROOM#ABC'],
            DisplayProtocol: 'Announce',
            CharacterId: '456',
            Message: 'Test',
            Title: 'TestTitle'
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
                            MessageId: 'CHARACTER#987',
                            DataCategory: 'MESSAGE#123',
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
            ]
        })
    })

    it('should add a new room description message', async () => {

        const data = await putMessage({
            MessageId: '123',
            CreatedTime: 123451234567,
            Targets: ['CHARACTER#987'],
            DisplayProtocol: 'RoomDescription',
            RoomId: '456',
            Name: 'TestRoom',
            Description: 'A sterile cell.',
            Exits: [
                {
                    RoomId: '345',
                    Name: 'archway',
                    Visibility: 'Public'
                }
            ],
            RoomCharacters: [
                {
                    CharacterId: 'ABC',
                    Pronouns: 'She, her'
                }
            ]
        })
        expect(data).toEqual({
            messageWrites: [
                {
                    PutRequest: {
                        Item: {
                            MessageId: 'MESSAGE#123',
                            DataCategory: 'Content',
                            DisplayProtocol: 'RoomDescription',
                            Name: 'TestRoom',
                            RoomId: '456',
                            Description: 'A sterile cell.',
                            Exits: [
                                {
                                    RoomId: '345',
                                    Name: 'archway',
                                    Visibility: 'Public'
                                }
                            ],
                            Characters: [
                                {
                                    CharacterId: 'ABC',
                                    Pronouns: 'She, her'
                                }
                            ],
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
                            DisplayProtocol: 'RoomDescription',
                            RoomId: '456',
                            Name: 'TestRoom',
                            Description: 'A sterile cell.',
                            Exits: [
                                {
                                    RoomId: '345',
                                    Name: 'archway',
                                    Visibility: 'Public'
                                }
                            ],
                            Characters: [
                                {
                                    CharacterId: 'ABC',
                                    Pronouns: 'She, her'
                                }
                            ]
                        }
                    }
                }
            ]
        })
    })
})
