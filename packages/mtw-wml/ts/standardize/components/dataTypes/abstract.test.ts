import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { componentTagFromUniversalKey } from './abstract'

describe('componentTagFromUniversalKey', () => {
    it('derives Room from ROOM# prefix', () => {
        expect(componentTagFromUniversalKey('ROOM#test' as ComponentUUID)).toBe('Room')
    })

    it('throws on invalid ComponentUUID', () => {
        expect(() => componentTagFromUniversalKey('not-a-uuid' as ComponentUUID)).toThrow(
            'Invalid ComponentUUID'
        )
    })

    it('throws on unknown component prefix', () => {
        expect(() => componentTagFromUniversalKey('NOTATAG#abc' as ComponentUUID)).toThrow(
            'Invalid ComponentUUID'
        )
    })
})
