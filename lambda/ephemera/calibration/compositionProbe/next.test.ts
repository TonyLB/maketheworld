import { planFromActions, type ActionPlan } from '../oracleLoop/actionPlan'
import type { PieceRequest, PieceState } from '../pieceProbe/piecePart'
import { applyResult, startState, type HopRecord, type LoopState } from './loopState'
import type { Mock } from './mocks'
import { castOf, next, type Cast } from './next'

const plan = planFromActions(['pick up [table1]'])
const detailed = planFromActions(['pick up [table1]', 'carry [table1] out'])
const shared: PieceState = { fixture: 'teaTable', plan, things: [], alsoShown: [] }
const ask = (kind: PieceRequest['kind']): PieceRequest => ({ kind, target: 'pick-up-table1', missing: 'how' })
const live = (piece: string): HopRecord => ({ piece, mocked: false, reply: 'text', problems: [] })

const cast = castOf('judge', [
    { piece: 'judge', answers: [] }, { piece: 'playByPlay', answers: ['action'] }, { piece: 'consequences', answers: ['consequences'] },
], [])
const CAP = 10

const start = startState(shared)
const asked = (kind: PieceRequest['kind'], state = start): LoopState => applyResult(state, live('judge'), { request: ask(kind) })
const answered = (piece: string, state: LoopState, given: ActionPlan = detailed): LoopState => applyResult(state, live(piece), { plan: given })

describe('next', () => {
    it('calls the judge at the start, with no request', () => {
        expect(next(start, cast, CAP)).toEqual({ call: { piece: 'judge' } })
    })

    it.each([['action', 'playByPlay'], ['consequences', 'consequences']] as const)('turns a judge\'s request for %s into a call on the piece that answers it', (kind, piece) => {
        expect(next(asked(kind), cast, CAP)).toEqual({ call: { piece, request: ask(kind) } })
    })

    it('goes back to the judge, with no request, when a generator has answered', () => {
        const state = answered('playByPlay', asked('action'))
        expect(state.shared.plan).toBe(detailed)
        expect(next(state, cast, CAP)).toEqual({ call: { piece: 'judge' } })
    })

    it('assumes no order, nor that a piece runs once: either kind first, and the same request met again', () => {
        const consequencesFirst = asked('action', answered('consequences', asked('consequences')))
        expect(next(consequencesFirst, cast, CAP)).toEqual({ call: { piece: 'playByPlay', request: ask('action') } })
        const again = asked('action', answered('playByPlay', asked('action')))
        expect(next(again, cast, CAP)).toEqual({ call: { piece: 'playByPlay', request: ask('action') } })
    })

    it('stops on a judge\'s verdict, at the cap too', () => {
        const state = applyResult(start, live('judge'), { verdict: 'blocks' })
        expect(next(state, cast, CAP)).toEqual({ stop: { reason: 'verdict', verdict: 'blocks' } })
        expect(next(state, cast, 1)).toEqual({ stop: { reason: 'verdict', verdict: 'blocks' } })
    })

    it('stops on a form fault, with its problems', () => {
        const state = applyResult(asked('action'), { ...live('playByPlay'), problems: ['has 1 sub-step'] })
        expect(next(state, cast, CAP)).toEqual({ stop: { reason: 'formFault', piece: 'playByPlay', problems: ['has 1 sub-step'] } })
    })

    it('stops on an error', () => {
        const state = applyResult(asked('action'), { piece: 'playByPlay', mocked: false, error: 'timed out' })
        expect(next(state, cast, CAP)).toEqual({ stop: { reason: 'error', piece: 'playByPlay', error: 'timed out' } })
    })

    describe('stops when nothing answers, naming what was asked for', () => {
        it('a kind no piece answers', () => {
            const without: Cast = castOf('judge', [{ piece: 'judge', answers: [] }, { piece: 'playByPlay', answers: ['action'] }], [])
            expect(next(asked('consequences'), without, CAP)).toEqual({ stop: { reason: 'nothingAnswers', request: ask('consequences') } })
        })

        it('a judge that isn\'t supplied', () => {
            expect(next(start, castOf('judge', [{ piece: 'playByPlay', answers: ['action'] }], []), CAP)).toEqual({ stop: { reason: 'nothingAnswers', piece: 'judge' } })
        })

        it('a mocked piece with no matching entry, judge or not, before the cap', () => {
            const mock = (piece: string, answers: Mock['answers']): Mock => ({ piece, answers, entries: [{ name: 'never', when: () => false, give: () => ({ verdict: 'allows' }) }] })
            expect(next(start, castOf('judge', [], [mock('judge', [])]), 0)).toEqual({ stop: { reason: 'nothingAnswers', piece: 'judge' } })
            expect(next(asked('action'), castOf('judge', [{ piece: 'judge', answers: [] }], [mock('playByPlay', ['action'])]), CAP))
                .toEqual({ stop: { reason: 'nothingAnswers', piece: 'playByPlay', request: ask('action') } })
        })
    })

    it('stops at the cap, counting every hop', () => {
        const state = answered('playByPlay', asked('action'))
        expect(next(state, cast, 3)).toEqual({ call: { piece: 'judge' } })
        expect(next(state, cast, 2)).toEqual({ stop: { reason: 'cap', cap: 2 } })
    })

    it('calls a mock by the entry that matches', () => {
        const entry = { name: 'allows', when: () => true, give: () => ({ verdict: 'allows' as const }) }
        expect(next(start, castOf('judge', [], [{ piece: 'judge', answers: [], entries: [entry] }]), CAP)).toEqual({ call: { piece: 'judge', mock: entry } })
    })
})

describe('the state', () => {
    it('logs the plan after each hop, and leaves the plan and the request as they were after a fault', () => {
        const state = applyResult(asked('action'), { ...live('playByPlay'), problems: ['x'] })
        expect(state.shared.plan).toBe(plan)
        expect(state.request).toEqual(ask('action'))
        expect(state.log.map((hop) => hop.plan)).toEqual([plan, plan])
        expect(answered('playByPlay', asked('action')).log.map((hop) => hop.plan)).toEqual([plan, detailed])
    })

    it('logs a judge\'s request and its verdict as what the hop gave', () => {
        expect(asked('action').log[0].gave).toEqual({ request: ask('action') })
        expect(applyResult(start, live('judge'), { verdict: 'allows' }).log[0].gave).toEqual({ verdict: 'allows' })
    })
})

describe('a run\'s cast', () => {
    it('refuses two pieces for one kind of request, and a piece supplied twice', () => {
        expect(() => castOf('judge', [{ piece: 'a', answers: ['action'] }, { piece: 'b', answers: ['action'] }], [])).toThrow('Two pieces answer a request for action: a, b')
        expect(() => castOf('judge', [{ piece: 'a', answers: ['action'] }], [{ piece: 'a', answers: ['consequences'], entries: [] }])).toThrow('a is supplied twice')
    })
})
