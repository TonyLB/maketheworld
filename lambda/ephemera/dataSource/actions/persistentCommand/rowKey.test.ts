import { persistentCommandDataCategory, persistentCommandKey } from './rowKey'

describe('persistentCommand rowKey', () => {
    it('keys the category by session', () => {
        expect(persistentCommandDataCategory('abc')).toEqual('SESSION#abc')
    })

    it('keys the row by character and session', () => {
        expect(persistentCommandKey('CHARACTER#TESS', 'abc')).toEqual({
            EphemeraId: 'CHARACTER#TESS',
            DataCategory: 'SESSION#abc',
        })
    })
})
