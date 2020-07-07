import exits from './exits.js'
import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods'

const testState = [
    {
        FromRoomId: 'ABC',
        ToRoomId: 'DEF',
        Name: 'Test One'
    },
    {
        FromRoomId: 'DEF',
        ToRoomId: 'ABC',
        Name: 'Test Two'
    }
]

describe('Exits reducer', () => {
    it('should return an empty array by default', () => {
        expect(exits()).toEqual([])
    })

    it('should return unchanged on a different action type', () => {
        expect(exits(testState, { type: 'OTHER' })).toEqual(testState)
    })

    it('should return unchanged on an empty list', () => {
        expect(exits(testState, { type: NEIGHBORHOOD_UPDATE, data: [] })).toEqual(testState)
    })

    it('should add a new exit', () => {
        expect(exits(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Exit: {
                    FromRoomId: 'DEF',
                    ToRoomId: 'GHI',
                    Name: 'Test Three'
                }
            }]
        })).toEqual([
            {
                FromRoomId: 'ABC',
                ToRoomId: 'DEF',
                Name: 'Test One'
            },
            {
                FromRoomId: 'DEF',
                ToRoomId: 'ABC',
                Name: 'Test Two'
            },
            {
                FromRoomId: 'DEF',
                ToRoomId: 'GHI',
                Name: 'Test Three'
            }
        ])
    })

    it('should update an exit', () => {
        expect(exits(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Exit: {
                    FromRoomId: 'ABC',
                    ToRoomId: 'DEF',
                    Name: 'Test Update'
                }
            }]
        })).toEqual([
            {
                FromRoomId: 'DEF',
                ToRoomId: 'ABC',
                Name: 'Test Two'
            },
            {
                FromRoomId: 'ABC',
                ToRoomId: 'DEF',
                Name: 'Test Update'
            }
        ])
    })

    it('should remove an exit', () => {
        expect(exits(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Exit: {
                    FromRoomId: 'DEF',
                    ToRoomId: 'ABC',
                    Delete: true
                }
            }]
        })).toEqual([
            {
                FromRoomId: 'ABC',
                ToRoomId: 'DEF',
                Name: 'Test One'
            }
        ])
    })

})
