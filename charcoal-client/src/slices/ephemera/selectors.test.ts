import { EphemeraPublic } from './baseClasses'
import {
    getCharactersInPlay
} from './selectors'

const testState: EphemeraPublic = {
    charactersInPlay: {
        'CHARACTER#TESS': {
            CharacterId: 'CHARACTER#TESS',
            Name: 'Tess',
            RoomId: 'ABC',
            color: {
                name: 'pink',
                primary: 'pink',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        },
        'CHARACTER#MARCO': {
            CharacterId: 'CHARACTER#MARCO',
            Name: 'Marco',
            RoomId: 'VORTEX',
            color: {
                name: 'green',
                primary: 'green',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        },
        'CHARACTER#ASAHINA': {
            CharacterId: 'CHARACTER#ASAHINA',
            Name: 'Asahina',
            RoomId: 'ABC',
            color: {
                name: 'green',
                primary: 'green',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }
    }
}
Object.preventExtensions(testState)

describe('charactersInPlay selectors', () => {

    it('should correctly return when characterInPlay data is present', () => {
        expect(getCharactersInPlay(testState)['CHARACTER#TESS']).toEqual({
            CharacterId: 'CHARACTER#TESS',
            Name: 'Tess',
            RoomId: 'ABC',
            color: {
                name: 'pink',
                primary: 'pink',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        })
    })

    it('should correctly return when no data is present', () => {
        expect(getCharactersInPlay(testState).SAIONJI).toEqual({
            CharacterId: 'SAIONJI',
            Name: '??????',
            color: {
                name: 'grey',
                primary: 'grey',
                light: 'grey',
                recap: 'grey',
                recapLight: 'grey',
                direct: 'grey'
            }
        })
    })

    it('should correctly handle Object.keys', () => {
        expect(Object.keys(getCharactersInPlay(testState))).toEqual(['CHARACTER#ASAHINA', 'CHARACTER#MARCO', 'CHARACTER#TESS'])
    })

    it('should correctly handle Object.values', () => {
        expect(Object.values(getCharactersInPlay(testState))).toEqual([{
            CharacterId: 'CHARACTER#ASAHINA',
            Name: 'Asahina',
            RoomId: 'ABC',
            color: {
                name: 'green',
                primary: 'green',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }, {
            CharacterId: 'CHARACTER#MARCO',
            Name: 'Marco',
            RoomId: 'VORTEX',
            color: {
                name: 'green',
                primary: 'green',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }, {
            CharacterId: 'CHARACTER#TESS',
            Name: 'Tess',
            RoomId: 'ABC',
            color: {
                name: 'pink',
                primary: 'pink',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }])
    })

    it('should correctly handle Object.entries', () => {
        expect(Object.entries(getCharactersInPlay(testState))).toEqual([['CHARACTER#ASAHINA', {
            CharacterId: 'CHARACTER#ASAHINA',
            Name: 'Asahina',
            RoomId: 'ABC',
            color: {
                name: 'green',
                primary: 'green',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }], ['CHARACTER#MARCO', {
            CharacterId: 'CHARACTER#MARCO',
            Name: 'Marco',
            RoomId: 'VORTEX',
            color: {
                name: 'green',
                primary: 'green',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }], ['CHARACTER#TESS', {
            CharacterId: 'CHARACTER#TESS',
            Name: 'Tess',
            RoomId: 'ABC',
            color: {
                name: 'pink',
                primary: 'pink',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }]])
    })
})
