import {
    getCharactersInPlay
} from './selectors'

const testState = {
    charactersInPlay: {
        TESS: {
            CharacterId: 'TESS',
            Name: 'Tess',
            Connected: true,
            RoomId: 'ABC',
            color: {
                primary: 'pink',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        },
        MARCO: {
            CharacterId: 'MARCO',
            Name: 'Marco',
            Connected: false,
            color: {
                primary: 'green',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        },
        ASAHINA: {
            CharacterId: 'ASAHINA',
            Name: 'Asahina',
            Connected: false,
            RoomId: 'ABC',
            color: {
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
        expect(getCharactersInPlay(testState).TESS).toEqual({
            CharacterId: 'TESS',
            Name: 'Tess',
            Connected: true,
            RoomId: 'ABC',
            color: {
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
            Connected: false,
            color: {
                primary: 'grey',
                light: 'grey',
                recap: 'grey',
                recapLight: 'grey',
                direct: 'grey'
            }
        })
    })

    it('should correctly handle Object.keys', () => {
        expect(Object.keys(getCharactersInPlay(testState))).toEqual(['ASAHINA', 'MARCO', 'TESS'])
    })

    it('should correctly handle Object.values', () => {
        expect(Object.values(getCharactersInPlay(testState))).toEqual([{
            CharacterId: 'ASAHINA',
            Name: 'Asahina',
            Connected: false,
            RoomId: 'ABC',
            color: {
                primary: 'green',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }, {
            CharacterId: 'MARCO',
            Name: 'Marco',
            Connected: false,
            color: {
                primary: 'green',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }, {
            CharacterId: 'TESS',
            Name: 'Tess',
            Connected: true,
            RoomId: 'ABC',
            color: {
                primary: 'pink',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }])
    })

    it('should correctly handle Object.entries', () => {
        expect(Object.entries(getCharactersInPlay(testState))).toEqual([['ASAHINA', {
            CharacterId: 'ASAHINA',
            Name: 'Asahina',
            Connected: false,
            RoomId: 'ABC',
            color: {
                primary: 'green',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }], ['MARCO', {
            CharacterId: 'MARCO',
            Name: 'Marco',
            Connected: false,
            color: {
                primary: 'green',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }], ['TESS', {
            CharacterId: 'TESS',
            Name: 'Tess',
            Connected: true,
            RoomId: 'ABC',
            color: {
                primary: 'pink',
                light: 'test',
                recap: 'test',
                recapLight: 'test',
                direct: 'test'
            }
        }]])
    })
})
