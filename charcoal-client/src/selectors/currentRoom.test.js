import { getVisibleExits } from './currentRoom.js'

describe('CurrentRoom Selectors', () => {
    const testState = {
        permanentHeaders: {
            '987': {
                permanentId: '987',
                type: 'ROOM',
                ancestry: '987'
            },
            '123': {
                permanentId: '123',
                type: 'NEIGHBORHOOD',
                ancestry: '123',
                visibility: 'Private'
            },
            '234': {
                permanentId: '234',
                type: 'ROOM',
                ancestry: '123:234'
            },
            '345': {
                permanentId: '345',
                type: 'NEIGHBORHOOD',
                ancestry: '345',
                visibility: 'Public'
            },
            '456': {
                permanentId: '456',
                type: 'ROOM',
                ancestry: '345:456'
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
        currentRoom: {
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
