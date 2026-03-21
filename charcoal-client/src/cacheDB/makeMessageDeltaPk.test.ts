import { describe, expect, it } from 'vitest'
import { makeMessageDeltaPk, stripMessageDeltaPk } from './makeMessageDeltaPk'

describe('makeMessageDeltaPk', () => {
    it('builds CreatedTime::MessageId', () => {
        expect(
            makeMessageDeltaPk({
                CreatedTime: 1_700_000_000_123,
                MessageId: 'MESSAGE#abc'
            })
        ).toBe('1700000000123::MESSAGE#abc')
    })
})

describe('stripMessageDeltaPk', () => {
    it('removes deltaPk and keeps Message fields', () => {
        const row = {
            DisplayProtocol: 'WorldMessage' as const,
            MessageId: 'MESSAGE#x',
            CreatedTime: 100,
            Target: 'CHARACTER#y' as const,
            Message: ['hi'],
            deltaPk: '100::MESSAGE#x'
        }
        const m = stripMessageDeltaPk(row)
        expect(m).toEqual({
            DisplayProtocol: 'WorldMessage',
            MessageId: 'MESSAGE#x',
            CreatedTime: 100,
            Target: 'CHARACTER#y',
            Message: ['hi']
        })
        expect('deltaPk' in m).toBe(false)
    })
})
