import {
    getCharactersInPlay
} from './charactersInPlay'

const testState = {
    charactersInPlay: {
        TESS: {
            CharacterId: 'TESS',
            Name: 'Tess',
            Pronouns: 'She/her',
            FirstImpression: 'Frumpy Goth',
            OneCoolThing: 'Fuchsia eyes',
            Outfit: 'A frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.',
            Connected: true,
            RoomId: 'ABC',
            color: {
                primary: 'pink'
            }
        },
        MARCO: {
            CharacterId: 'MARCO',
            Name: 'Marco',
            Pronouns: 'He/him',
            FirstImpression: 'Earth princess'
        },
        ASAHINA: {
            CharacterId: 'ASAHINA',
            Connected: false,
            RoomId: 'ABC',
            color: {
                primary: 'green'
            }
        }
    }
}

describe('charactersInPlay selectors', () => {

    it('should correctly return when both character and characterInPlay data is present', () => {
        expect(getCharactersInPlay(testState).TESS).toEqual({
            CharacterId: 'TESS',
            Name: 'Tess',
            Pronouns: 'She/her',
            FirstImpression: 'Frumpy Goth',
            OneCoolThing: 'Fuchsia eyes',
            Outfit: 'A frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.',
            Connected: true,
            RoomId: 'ABC',
            color: {
                primary: 'pink'
            }
        })
    })

    it('should correctly return when only character data is present', () => {
        expect(getCharactersInPlay(testState).MARCO).toEqual({
            CharacterId: 'MARCO',
            Name: 'Marco',
            Pronouns: 'He/him',
            FirstImpression: 'Earth princess',
            Connected: false,
            color: {
                primary: 'grey'
            }
        })
    })

    it('should correctly return when only characterInPlay data is present', () => {
        expect(getCharactersInPlay(testState).ASAHINA).toEqual({
            CharacterId: 'ASAHINA',
            Name: '????',
            Connected: false,
            RoomId: 'ABC',
            color: {
                primary: 'green'
            }
        })
    })

    it('should correctly return when no data is present', () => {
        expect(getCharactersInPlay(testState).SAIONJI).toEqual({
            CharacterId: 'SAIONJI',
            Name: '????',
            Connected: false,
            color: {
                primary: 'grey'
            }
        })
    })

    it('should correctly handle Object.keys', () => {
        expect(Object.keys(getCharactersInPlay(testState))).toEqual(['ASAHINA', 'MARCO', 'TESS'])
    })

    it('should correctly handle Object.values', () => {
        expect(Object.values(getCharactersInPlay(testState))).toEqual([{
            CharacterId: 'ASAHINA',
            Name: '????',
            Connected: false,
            RoomId: 'ABC',
            color: {
                primary: 'green'
            }
        }, {
            CharacterId: 'MARCO',
            Name: 'Marco',
            Pronouns: 'He/him',
            FirstImpression: 'Earth princess',
            Connected: false,
            color: {
                primary: 'grey'
            }
        }, {
            CharacterId: 'TESS',
            Name: 'Tess',
            Pronouns: 'She/her',
            FirstImpression: 'Frumpy Goth',
            OneCoolThing: 'Fuchsia eyes',
            Outfit: 'A frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.',
            Connected: true,
            RoomId: 'ABC',
            color: {
                primary: 'pink'
            }
        }])
    })

    it('should correctly handle Object.entries', () => {
        expect(Object.entries(getCharactersInPlay(testState))).toEqual([['ASAHINA', {
            CharacterId: 'ASAHINA',
            Name: '????',
            Connected: false,
            RoomId: 'ABC',
            color: {
                primary: 'green'
            }
        }], ['MARCO', {
            CharacterId: 'MARCO',
            Name: 'Marco',
            Pronouns: 'He/him',
            FirstImpression: 'Earth princess',
            Connected: false,
            color: {
                primary: 'grey'
            }
        }], ['TESS', {
            CharacterId: 'TESS',
            Name: 'Tess',
            Pronouns: 'She/her',
            FirstImpression: 'Frumpy Goth',
            OneCoolThing: 'Fuchsia eyes',
            Outfit: 'A frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.',
            Connected: true,
            RoomId: 'ABC',
            color: {
                primary: 'pink'
            }
        }]])
    })
})
