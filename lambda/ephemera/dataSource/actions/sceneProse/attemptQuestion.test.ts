import { CommandAttempt } from '../commandAttempt'
import { NarrateAttemptAction, NavigateAttemptAction, PositionAttemptAction } from '../commandAttempt/action'
import type { ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import { actingCharacterRef, currentHostRef, objectSpanRef, type GroundedId, type ObjectSpanReferent, type PlanStep, type Referent } from '../enrich/objectManipulation/plan/planStep'
import type { SceneHandleTable } from '../../positions/ludicCache/sceneModel'
import { attemptQuestion } from './attemptQuestion'

const table = [
    { handle: 'cup1', id: 'OBJECT#cup-a' },
    { handle: 'cup2', id: 'OBJECT#cup-b' },
    { handle: 'tray1', id: 'OBJECT#tray' },
] as SceneHandleTable

const thing = (span: string, id: string, shortName = span): ObjectSpanReferent => ({ referentType: 'objectSpan', span, stableRefKey: `key-${span}`, groundedId: id as GroundedId, shortName })

const take = (object: Referent): PlanStep => ({ kind: 'change', primitive: 'transferMembership', object, from: currentHostRef(object), to: actingCharacterRef })
const put = (object: Referent, to: Referent): PlanStep => ({ kind: 'change', primitive: 'transferMembership', object, from: currentHostRef(object), to, containment: 'On' })

const attempt = (words: string, ...actions: PositionAttemptAction[]) => CommandAttempt.create('membership', words, actions)

describe('attemptQuestion', () => {
    it('adds the handle beside the name, once per thing, and none for the actor', () => {
        const cup = thing('cup', 'OBJECT#cup-a')
        const result = attemptQuestion(attempt('pick up the cup', new PositionAttemptAction('a1', [], take(cup), 'Take: cup')), table)
        expect(result).toEqual({
            kind: 'question',
            text: ['I said: "pick up the cup".', 'To do that I would:', '- Take: cup ([cup1] = cup)', 'Could I?'].join('\n'),
        })
    })

    it('tells two same-named things apart by handle', () => {
        const second = thing('cup', 'OBJECT#cup-b')
        const result = attemptQuestion(attempt('take the cup', new PositionAttemptAction('a1', [], take(second), 'Take: cup')), table)
        expect(result).toMatchObject({ kind: 'question' })
        expect((result as { text: string }).text).toContain('[cup2] = cup')
        expect((result as { text: string }).text).not.toContain('[cup1]')
    })

    it('lists a facilitating action before the primary, each with its own handles', () => {
        const cup = thing('cup', 'OBJECT#cup-a')
        const tray = thing('tray', 'OBJECT#tray')
        const result = attemptQuestion(attempt(
            'put the cup on the tray',
            new PositionAttemptAction('a1', [], take(cup), 'Take: cup'),
            new PositionAttemptAction('a2', [], put(cup, tray), 'Put cup on tray'),
        ), table)
        const lines = (result as { text: string }).text.split('\n')
        expect(lines.slice(2, 4)).toEqual(['- Take: cup ([cup1] = cup)', '- Put cup on tray ([cup1] = cup, [tray1] = tray)'])
    })

    describe('with the fill\'s skeleton', () => {
        const span = (text: string): ParseSkeleton[number] => ({ type: 'objectSpan', span: `the ${text}`, stableRefKey: `key-${text}` })
        const cup = thing('cup', 'OBJECT#cup-a')
        const tray = thing('tray', 'OBJECT#tray')
        const putSkeleton: ParseSkeleton = [{ type: 'text', text: 'shove' }, span('cup'), { type: 'text', text: 'onto' }, span('tray')]

        it('words the primary action in the player\'s own words, with handles for the spans', () => {
            const result = attemptQuestion(attempt('shove the cup onto the tray', new PositionAttemptAction('a1', [], put(cup, tray), 'Put cup on tray')), table, putSkeleton)
            expect(result).toEqual({ kind: 'question', text: 'I want to: shove [cup1] onto [tray1].\nCould I?' })
        })

        it('words a judge request as a sentence for Request, with no closing question', () => {
            const result = attemptQuestion(attempt('shove the cup onto the tray', new PositionAttemptAction('a1', [], put(cup, tray), 'Put cup on tray')), table, putSkeleton, 'judge')
            expect(result).toEqual({ kind: 'question', text: 'I want to shove [cup1] onto [tray1].' })
        })

        it('keeps the description and handle clause for a facilitating action, which has no words', () => {
            const result = attemptQuestion(attempt(
                'shove the cup onto the tray',
                new PositionAttemptAction('a1', [], take(cup), 'Take: cup'),
                new PositionAttemptAction('a2', [], put(cup, tray), 'Put cup on tray'),
            ), table, putSkeleton)
            expect(result).toEqual({
                kind: 'question',
                text: ['I want to: shove [cup1] onto [tray1].', 'To do that I would first:', '- Take: cup ([cup1] = cup)', 'Could I?'].join('\n'),
            })
        })

        it('gives a handle to each span, even two spans that mean one thing', () => {
            const again: ObjectSpanReferent = { ...cup, stableRefKey: 'key-mug' }
            const skeleton: ParseSkeleton = [{ type: 'text', text: 'put' }, span('cup'), { type: 'text', text: 'on' }, span('mug')]
            const result = attemptQuestion(attempt('put the cup on the mug', new PositionAttemptAction('a1', [], put(cup, again), 'Put cup on cup')), table, skeleton)
            expect(result).toEqual({ kind: 'question', text: 'I want to: put [cup1] on [cup1].\nCould I?' })
        })

        it('still returns what the scene does not show', () => {
            const ghost = thing('ghost', 'OBJECT#elsewhere')
            const result = attemptQuestion(attempt('x', new PositionAttemptAction('a1', [], take(ghost), 'Take: ghost')), table, [{ type: 'text', text: 'get' }, span('ghost')])
            expect(result).toMatchObject({ kind: 'unmapped' })
        })
    })

    it('returns the things the scene does not show instead of guessing', () => {
        const ghost = thing('ghost', 'OBJECT#elsewhere')
        const ungrounded = objectSpanRef('mist')
        const result = attemptQuestion(attempt('x', new PositionAttemptAction('a1', [], put(ghost, ungrounded), 'Put ghost on mist')), table)
        expect(result).toEqual({
            kind: 'unmapped',
            referents: [
                { span: 'ghost', shortName: 'ghost', id: 'OBJECT#elsewhere' },
                { span: 'mist' },
            ],
        })
    })

    it('passes a narration through with its handle and a navigation without one', () => {
        const cup = thing('cup', 'OBJECT#cup-a')
        const look = new NarrateAttemptAction('n1', [], 'Look at the cup', [cup])
        const go = new NavigateAttemptAction('g1', [], objectSpanRef('north'))
        const lookText = attemptQuestion(CommandAttempt.create('look', 'look at the cup', [look]), table)
        expect((lookText as { text: string }).text).toContain('- Look at the cup ([cup1] = cup)')
        const goResult = attemptQuestion(CommandAttempt.create('navigation', 'go north', [go]), table)
        expect((goResult as { text: string }).text).toContain('- Go north\nCould I?')
    })

    it('throws on an action with no description, and changes neither input', () => {
        const cup = thing('cup', 'OBJECT#cup-a')
        expect(() => attemptQuestion(attempt('x', new PositionAttemptAction('a1', [], take(cup))), table)).toThrow(/no description/)
        const frozen = Object.freeze(table.map((row) => Object.freeze(row))) as unknown as SceneHandleTable
        const original = attempt('pick up the cup', new PositionAttemptAction('a1', [], take(cup), 'Take: cup'))
        const before = JSON.stringify(original.toJSON())
        attemptQuestion(original, frozen)
        expect(JSON.stringify(original.toJSON())).toBe(before)
    })
})
