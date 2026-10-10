import type { ParseCommandConsultResult } from './baseClasses'
import { askRowPayload, selectQuestionFromConsult } from './selectQuestion'
import { isPersistentCommandPayload } from './persistentCommand/payload'
import { takeCupPayload } from './persistentCommand/testFixtures'

const { root } = takeCupPayload()

const consult = (alternatives: ParseCommandConsultResult['alternatives'], withRoot = true): ParseCommandConsultResult => ({
    type: 'Consult',
    confidence: 0.9,
    alternatives,
    ...(withRoot ? { root } : {}),
})

const twoCups = consult([
    { proposedCommand: 'take cup', label: 'red cup', referentAnswers: { 'ref-1': 'OBJECT#RedCup' } },
    { proposedCommand: 'take cup', referentAnswers: { 'ref-1': 'OBJECT#BlueCup' } },
] as any)

const counter = () => {
    let next = 0
    return () => `option-${next++}`
}

describe('selectQuestionFromConsult', () => {
    it('makes one option per alternative, each mapped to its own assignment', () => {
        const question = selectQuestionFromConsult(twoCups, counter())!
        expect(question.pending.options).toEqual({
            'option-0': { 'ref-1': 'OBJECT#RedCup' },
            'option-1': { 'ref-1': 'OBJECT#BlueCup' },
        })
        expect(question.outcome).toEqual({
            Kind: 'Select',
            Message: ['Which did you mean?'],
            Options: [
                { OptionId: 'option-0', Label: ['red cup'] },
                { OptionId: 'option-1', Label: ['take cup'] },
            ],
        })
        expect(question.root).toBe(root)
    })

    it('keeps a multi-key assignment whole', () => {
        const question = selectQuestionFromConsult(consult([
            { proposedCommand: 'a', referentAnswers: { 'ref-1': 'OBJECT#A', 'ref-2': 'OBJECT#X' } },
            { proposedCommand: 'b', referentAnswers: { 'ref-1': 'OBJECT#A', 'ref-2': 'OBJECT#Y' } },
        ] as any), counter())!
        expect(question.pending.options['option-1']).toEqual({ 'ref-1': 'OBJECT#A', 'ref-2': 'OBJECT#Y' })
    })

    it('mints a distinct option id each time it is asked', () => {
        const ids = (question: ReturnType<typeof selectQuestionFromConsult>) => Object.keys(question!.pending.options)
        const first = ids(selectQuestionFromConsult(twoCups, () => Math.random().toString()))
        const second = ids(selectQuestionFromConsult(twoCups, () => Math.random().toString()))
        expect(new Set([...first, ...second]).size).toBe(4)
    })

    it.each<[string, ParseCommandConsultResult]>([
        ['identical assignments (a Consult that differs by plan)', consult([
            { proposedCommand: 'a', referentAnswers: { 'ref-1': 'OBJECT#A', 'ref-2': 'OBJECT#X' } },
            { proposedCommand: 'b', referentAnswers: { 'ref-2': 'OBJECT#X', 'ref-1': 'OBJECT#A' } },
        ] as any)],
        ['an alternative with no referentAnswers', consult([
            { proposedCommand: 'a', referentAnswers: { 'ref-1': 'OBJECT#A' } },
            { proposedCommand: 'b' },
        ] as any)],
        ['an empty assignment', consult([
            { proposedCommand: 'a', referentAnswers: { 'ref-1': 'OBJECT#A' } },
            { proposedCommand: 'b', referentAnswers: {} },
        ] as any)],
        ['a single alternative', consult([
            { proposedCommand: 'a', referentAnswers: { 'ref-1': 'OBJECT#A' } },
        ] as any)],
        ['no frozen root', consult(twoCups.alternatives, false)],
    ])('declines %s', (_label, result) => {
        expect(selectQuestionFromConsult(result, counter())).toBeUndefined()
    })
})

describe('askRowPayload', () => {
    const transcript = { messageId: 'MESSAGE#1', createdTime: 1700000000000, command: 'take cup', sessionId: 'abc' }

    it('builds a row that passes the payload guard, without the session', () => {
        const payload = askRowPayload(selectQuestionFromConsult(twoCups, counter())!, transcript)
        expect(isPersistentCommandPayload(payload)).toBe(true)
        expect(payload.transcript).toEqual({ messageId: 'MESSAGE#1', createdTime: 1700000000000, command: 'take cup' })
        expect(payload.referentAnswers).toEqual({})
    })

    it('keeps the answers already given when it asks again', () => {
        const prior = {
            referentAnswers: { 'ref-0': 'OBJECT#Box' },
            challengeAnswers: { 'exitEdge:a': { verdict: { kind: 'met' as const }, source: 'player' as const } },
        }
        const payload = askRowPayload(selectQuestionFromConsult(twoCups, counter())!, transcript, prior)
        expect(payload.referentAnswers).toEqual(prior.referentAnswers)
        expect(payload.challengeAnswers).toEqual(prior.challengeAnswers)
        expect(Object.keys(payload.pending!.options)).toEqual(['option-0', 'option-1'])
    })
})
