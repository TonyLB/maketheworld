import { consequencesCells } from '../imaginationPieces/consequences'
import { playByPlayCells } from '../imaginationPieces/playByPlay'
import { nonRuleCellCells } from '../oraclePieces/nonRuleCell'
import { mintPaths, orderItems, planFromActions, planFromCandidateSteps, planFromNonRuleSteps, renderPlanForGenerator, slug, type ActionPlan } from './actionPlan'
import { oracleCases } from './oracleCases'

const allPaths = ({ steps }: ActionPlan): string[] => steps.flatMap(({ path, items }) => [path, ...items.map((item) => item.path)])

/** Every path unique in the plan, every item's path under its step's, and at most one intent per step. */
const expectWellFormed = (id: string, plan: ActionPlan): void => {
    const paths = allPaths(plan)
    expect([id, new Set(paths).size]).toEqual([id, paths.length])
    for (const { path, items } of plan.steps) {
        expect([id, items.every((item) => item.path.startsWith(`${path}.`) && !item.path.slice(path.length + 1).includes('.'))]).toEqual([id, true])
        expect([id, items.filter(({ kind }) => kind === 'intent').length <= 1]).toEqual([id, true])
        expect([id, orderItems(items)]).toEqual([id, items])
    }
}

describe('the action plan', () => {
    describe('slugs', () => {
        it.each([
            ['tip [table1]', 'tip-table1'],
            ['pick up [saucer1]', 'pick-up-saucer1'],
            ['[teapot1] pours [tea2] into [cup1]', 'teapot1-pours-tea2'],
            ['[saucer1] and [cup1] slide off [table1] onto the floor', 'saucer1-cup1-slide'],
            ['[cup1] is no longer under [teapot1]\'s spout', 'cup1-no-longer'],
            ['put [table1] in [cup1]', 'put-table1-in'],
            ['"tip [table1]"', 'tip-table1'],
        ])('slugs %j as %s', (text, expected) => {
            expect(slug(text, 'step')).toBe(expected)
        })

        it('falls back to the scope\'s word when nothing remains', () => {
            expect(slug('the and of', 'step')).toBe('step')
            expect(slug('...', 'concern')).toBe('concern')
        })

        it('tells repeats in one scope apart with -2, -3, in order', () => {
            expect(mintPaths(['tip [table1]', 'pick up [cup1]', 'tip the [table1]', 'tip [table1] again', 'the'].map((says) => ({ says, fallback: 'step' }))))
                .toEqual(['tip-table1', 'pick-up-cup1', 'tip-table1-2', 'tip-table1-again', 'step'])
        })
    })

    it('orders items by kind, and within a kind as given', () => {
        const items = [
            { kind: 'concern', says: 'c1' }, { kind: 'consequence', says: 'q1' }, { kind: 'intent', says: 'i' },
            { kind: 'concern', says: 'c2' }, { kind: 'consequence', says: 'q2' },
        ] as const
        expect(orderItems(items).map(({ says }) => says)).toEqual(['i', 'q1', 'q2', 'c1', 'c2'])
    })

    describe('built from every existing cell', () => {
        it('the corpus: every candidate\'s steps kept as they are, with a path each and no items', () => {
            const candidates = Object.entries(oracleCases).flatMap(([id, { candidates }]) => candidates.map((candidate) => [`${id}/${candidate.id}`, candidate] as const))
            expect(candidates.length).toBeGreaterThan(0)
            for (const [id, { steps }] of candidates) {
                const plan = planFromCandidateSteps(steps)
                expectWellFormed(id, plan)
                expect([id, plan.steps.map(({ path, items, ...step }) => ({ step, items }))]).toEqual([id, steps.map((step) => ({ step, items: [] }))])
            }
        })

        it('the non-rule cell\'s steps, and so the trial\'s, which reuse them', () => {
            for (const [id, { inputs: { steps } }] of Object.entries(nonRuleCellCells)) {
                const plan = planFromNonRuleSteps(steps)
                expectWellFormed(id, plan)
                expect([id, plan.steps.every(({ suppliedBy }) => suppliedBy === 'system')]).toEqual([id, true])
            }
        })

        it('the imagination\'s actions, each a step supplied by the system', () => {
            for (const [id, { inputs: { actions } }] of [...Object.entries(playByPlayCells), ...Object.entries(consequencesCells)]) {
                const plan = planFromActions(actions)
                expectWellFormed(id, plan)
                expect([id, plan.steps.map(({ says, suppliedBy, items }) => ({ says, suppliedBy, items }))]).toEqual([id, actions.map((says) => ({ says, suppliedBy: 'system', items: [] }))])
            }
        })

        it('is stable: the same inputs build equal plans', () => {
            for (const { inputs: { steps } } of Object.values(nonRuleCellCells)) {
                expect(planFromNonRuleSteps(steps)).toEqual(planFromNonRuleSteps(steps))
            }
        })
    })

    describe('the trial\'s roles, under AP-7', () => {
        const intent = { kind: 'intent', path: 'tip-table1.teapot1-pours-tea2', says: '[teapot1] pours [tea2] into [cup1]' }
        const intendedPour = { kind: 'consequence', path: 'tip-table1.teapot1-pours-tea2-2', says: '[teapot1] pours [tea2] into [cup1]', intended: true }
        const tip = { says: 'tip [table1]', suppliedBy: 'system', path: 'tip-table1', items: [intent, intendedPour] }

        it('h5: the pour folds into the tip as its intent and its intended consequence', () => {
            expect(planFromNonRuleSteps(nonRuleCellCells['OC-30/h5'].inputs.steps)).toEqual({ steps: [tip] })
        })

        it('h7: the slide line follows the intended pour', () => {
            expect(planFromNonRuleSteps(nonRuleCellCells['OC-30/h7'].inputs.steps)).toEqual({ steps: [{
                ...tip, items: [intent, intendedPour, { kind: 'consequence', path: 'tip-table1.saucer1-cup1-slide', says: '[saucer1] and [cup1] slide off [table1] onto the floor' }],
            }] })
        })

        it('h10: the saucer picked up first, with no items, then the tip as in h5', () => {
            expect(planFromNonRuleSteps(nonRuleCellCells['OC-30/h10'].inputs.steps)).toEqual({ steps: [
                { says: 'pick up [saucer1]', suppliedBy: 'system', path: 'pick-up-saucer1', items: [] },
                tip,
            ] })
        })

        it('a single intended step stays a step, with an intent of its own text and no intended consequence', () => {
            expect(planFromNonRuleSteps(nonRuleCellCells['OC-2'].inputs.steps)).toEqual({ steps: [
                { says: 'pick up [cup1]', suppliedBy: 'system', path: 'pick-up-cup1', items: [{ kind: 'intent', path: 'pick-up-cup1.pick-up-cup1', says: 'pick up [cup1]' }] },
            ] })
        })

        it('refuses a second intent on one method step', () => {
            expect(() => planFromNonRuleSteps([
                { says: 'tip [table1]', role: 'method' }, { says: 'it pours', role: 'intended' }, { says: 'it fills', role: 'intended' },
            ])).toThrow('One intent per step: "it fills" follows "tip [table1]", which already has "it pours"')
        })
    })

    it('renders a plan for a generator: a line per step, its items indented with their kind and path', () => {
        expect(renderPlanForGenerator(planFromNonRuleSteps(nonRuleCellCells['OC-30/h10'].inputs.steps))).toBe([
            'Step pick-up-saucer1: pick up [saucer1]',
            'Step tip-table1: tip [table1]',
            '  - intent tip-table1.teapot1-pours-tea2: [teapot1] pours [tea2] into [cup1]',
            '  - consequence (intended) tip-table1.teapot1-pours-tea2-2: [teapot1] pours [tea2] into [cup1]',
        ].join('\n'))
        expect(renderPlanForGenerator(planFromNonRuleSteps(nonRuleCellCells['OC-30/h7'].inputs.steps)).split('\n').slice(-1)[0])
            .toBe('  - consequence tip-table1.saucer1-cup1-slide: [saucer1] and [cup1] slide off [table1] onto the floor')
    })
})
