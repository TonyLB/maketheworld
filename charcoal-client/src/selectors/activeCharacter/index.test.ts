import { getVisibleExits } from './index'

describe('CurrentRoom Selectors', () => {
    const testState = {
        exits: [
            {
                FromRoomId: '987',
                ToRoomId: '234',
                Name: 'TestOne'
            },
            {
                FromRoomId: '987',
                ToRoomId: '456',
                Name: 'TestTwo'
            }
        ],
        permanentHeaders: {
            '987': {
                PermanentId: '987',
                Type: 'ROOM',
                Ancestry: '987'
            },
            '123': {
                PermanentId: '123',
                Ancestry: '123',
                Type: 'NEIGHBORHOOD',
                Visibility: 'Private'
            },
            '234': {
                PermanentId: '234',
                ParentId: '123',
                Ancestry: '123:234',
                Type: 'ROOM',
            },
            '345': {
                PermanentId: '345',
                Ancestry: '345',
                Type: 'NEIGHBORHOOD',
                Visibility: 'Public'
            },
            '456': {
                PermanentId: '456',
                ParentId: '345',
                Ancestry: '345:456',
                Type: 'ROOM',
            }
        },
        characters: {
            ABC: {
                CharacterId: 'ABC',
            },
            BCD: {
                CharacterId: 'BCD',
            }
        },
        grants: {
            ABC: [
                {
                    CharacterId: 'ABC',
                    Resource: '123',
                    Actions: 'View'
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
        expect(getVisibleExits('BCD')({
            ...testState
        })).toEqual([
            {
                Name: 'TestTwo',
                RoomId: '456',
                Visibility: 'Public'
            }
        ])
    })

    it('should return public and private links when grants exist', () => {
        expect(getVisibleExits('ABC')({
            ...testState
        })).toEqual([
            {
                Name: 'TestOne',
                RoomId: '234',
                Visibility: 'Private'
            },
            {
                Name: 'TestTwo',
                RoomId: '456',
                Visibility: 'Public'
            }
        ])
    })

})
