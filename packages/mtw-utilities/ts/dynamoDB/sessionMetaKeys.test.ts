import {
    META_SESSION_PK,
    sessionMetaSortKey,
    sessionIdFromMetaSortKey,
    playerSessionsPK,
    playerFromSessionsPK
} from './sessionMetaKeys'

describe('playerSessionsPK', () => {
    it('builds a PLAYER# partition key', () => {
        expect(playerSessionsPK('bob')).toBe('PLAYER#bob')
    })
})

describe('playerFromSessionsPK', () => {
    it('extracts the bare player from a PLAYER# partition key', () => {
        expect(playerFromSessionsPK('PLAYER#bob')).toBe('bob')
    })

    it('returns undefined for a non-PLAYER# string', () => {
        expect(playerFromSessionsPK(META_SESSION_PK)).toBeUndefined()
        expect(playerFromSessionsPK('SESSION#xyz')).toBeUndefined()
    })
})

describe('pointer row key round trip', () => {
    it('recovers player and sessionId from constructed pointer keys', () => {
        const player = 'bob'
        const sessionId = 'xyz'
        const connectionId = playerSessionsPK(player)
        const dataCategory = sessionMetaSortKey(sessionId)
        expect(playerFromSessionsPK(connectionId)).toBe(player)
        expect(sessionIdFromMetaSortKey(dataCategory)).toBe(sessionId)
    })
})
