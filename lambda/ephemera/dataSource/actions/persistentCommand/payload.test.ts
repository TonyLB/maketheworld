import { isPersistentCommandPayload } from './payload'
import { takeCupPayload, twoCupPendingPayload } from './testFixtures'

describe('isPersistentCommandPayload', () => {
    it('accepts a payload built from a real plan', () => {
        expect(isPersistentCommandPayload(takeCupPayload())).toBe(true)
    })

    it('accepts a payload with no selected attempt and no answers', () => {
        const { selectedAttempt, ...rest } = takeCupPayload()
        expect(isPersistentCommandPayload({ ...rest, referentAnswers: {}, challengeAnswers: {} })).toBe(true)
    })

    it('accepts a row written before transcript existed', () => {
        const { transcript, ...rest } = takeCupPayload()
        expect(isPersistentCommandPayload(rest)).toBe(true)
    })

    it('accepts a pending question, answered or not', () => {
        const payload = twoCupPendingPayload()
        expect(isPersistentCommandPayload(payload)).toBe(true)
        expect(isPersistentCommandPayload({ ...payload, pending: { ...payload.pending, answer: 'option-blue' } })).toBe(true)
    })

    it.each<[string, (payload: any) => any]>([
        ['a non-record pending', (payload) => ({ ...payload, pending: 'x' })],
        ['pending without options', (payload) => ({ ...payload, pending: {} })],
        ['an option mapping to a non-record', (payload) => ({ ...payload, pending: { options: { a: 'x' } } })],
        ['a non-string answer in an option', (payload) => ({ ...payload, pending: { options: { a: { k: 3 } } } })],
        ['a non-string pending answer', (payload) => ({ ...payload, pending: { ...payload.pending, answer: 3 } })],
        ['a pending answer that names no option', (payload) => ({ ...payload, pending: { ...payload.pending, answer: 'option-green' } })],
    ])('rejects %s', (_label, corrupt) => {
        expect(isPersistentCommandPayload(corrupt(twoCupPendingPayload()))).toBe(false)
    })

    it.each<[string, (payload: any) => any]>([
        ['a non-object transcript', (payload) => ({ ...payload, transcript: 'x' })],
        ['a non-string transcript messageId', ({ transcript, ...rest }) => ({ ...rest, transcript: { ...transcript, messageId: 3 } })],
        ['a non-numeric transcript createdTime', ({ transcript, ...rest }) => ({ ...rest, transcript: { ...transcript, createdTime: 'now' } })],
        ['a non-string transcript command', ({ transcript, ...rest }) => ({ ...rest, transcript: { ...transcript, command: 3 } })],
        ['a non-object', () => 'nope'],
        ['a missing root', ({ root, ...rest }) => rest],
        ['a root without a command', ({ root, ...rest }) => ({ ...rest, root: { ...root, command: 5 } })],
        ['a malformed skeleton token', ({ root, ...rest }) => ({ ...rest, root: { ...root, skeleton: [{ type: 'objectSpan', span: 'cup' }] } })],
        ['a malformed attempt', ({ root, ...rest }) => ({ ...rest, root: { ...root, attempts: [{ words: 'x' }] } })],
        ['a non-numeric confidence', ({ root, ...rest }) => ({ ...rest, root: { ...root, confidence: 'high' } })],
        ['a non-string selectedAttempt', (payload) => ({ ...payload, selectedAttempt: 3 })],
        ['a non-string referent answer', (payload) => ({ ...payload, referentAnswers: { a: 3 } })],
        ['a missing challengeAnswers', ({ challengeAnswers, ...rest }) => rest],
        ['an answer with an unknown source', (payload) => ({ ...payload, challengeAnswers: { a: { verdict: { kind: 'met' }, source: 'oracle' } } })],
        ['an answer with a malformed verdict', (payload) => ({ ...payload, challengeAnswers: { a: { verdict: { kind: 'impossible' }, source: 'player' } } })],
    ])('rejects %s', (_label, corrupt) => {
        expect(isPersistentCommandPayload(corrupt(takeCupPayload()))).toBe(false)
    })
})
