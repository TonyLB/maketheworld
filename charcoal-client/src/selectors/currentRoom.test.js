import { getVisibleExits } from './currentRoom.js'

describe('CurrentRoom Selectors', () => {
    const testState = {
        permanentHeaders: {
            '987': {
                PermanentId: '987',
                Type: 'ROOM',
                Ancestry: '987',
                Exits: [
                    {
                        Name: 'TestOne',
                        Ancestry: '123:234'
                    },
                    {
                        Name: 'TestTwo',
                        Ancestry: '345:456'
                    }
                ]
            },
            '123': {
                PermanentId: '123',
                Type: 'NEIGHBORHOOD',
                Ancestry: '123',
                Visibility: 'Private'
            },
            '234': {
                PermanentId: '234',
                Type: 'ROOM',
                Ancestry: '123:234'
            },
            '345': {
                PermanentId: '345',
                Type: 'NEIGHBORHOOD',
                Ancestry: '345',
                Visibility: 'Public'
            },
            '456': {
                PermanentId: '456',
                Type: 'ROOM',
                Ancestry: '345:456'
            }
        },
        myCharacters: {
            meta: { fetching: false, fetched: true },
            data: [
                {
                    CharacterId: 'ABC',
                    Grants: [
                        { Resource: '123', Actions: 'View' }
                    ]
                },
                {
                    CharacterId: 'BCD',
                    Grants: []
                }
            ]
        },
        charactersInPlay: {
            'ABC': {
                CharacterId: 'ABC',
                RoomId: '987'
            },
            'BCD': {
                CharacterId: 'BCD',
                RoomId: '987'
            },
        }
    }

    it('should return only public links when no grants', () => {
        expect(getVisibleExits({
            ...testState,
            connection: { characterId: 'BCD' }
        })).toEqual([
            {
                Name: 'TestTwo',
                Ancestry: '345:456',
                Visibility: 'Public'
            }
        ])
    })

    it('should return public and private links when grants exist', () => {
        expect(getVisibleExits({
            ...testState,
            connection: { characterId: 'ABC' }
        })).toEqual([
            {
                Name: 'TestOne',
                Ancestry: '123:234',
                Visibility: 'Private'
            },
            {
                Name: 'TestTwo',
                Ancestry: '345:456',
                Visibility: 'Public'
            }
        ])
    })

})
