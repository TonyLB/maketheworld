import { consequencesCells } from '../imaginationPieces/consequences'
import { fixtureScene } from '../imaginationPieces/imaginationScene'
import { playByPlayCells } from '../imaginationPieces/playByPlay'
import { nonRuleCellCells } from '../oraclePieces/nonRuleCell'
import { bracketChanges, bracketHandles, itemPaths, mergeChanges, mergeStepChanges, mintPaths, orderItems, planChangesContract, planOf, planFromActions, planFromCandidateSteps, planFromNonRuleSteps, planSteps, renderPlanForGenerator, slug, viewPlan, WHOLE_PLAN_VIEW, type ActionPlan, type MergeOptions } from './actionPlan'
import { oracleCases } from './oracleCases'

const allPaths = ({ steps }: ActionPlan): string[] => steps.flatMap(({ path, items }) => [path, ...items.flatMap(itemPaths)])

/**
 * Every path unique in the plan; for every step at any depth, each item in its own scope (its non-`step` items: a sub-step's path is a
 * step path, the one exception) under the step's path; at most one intent per step; the items in order.
 */
const expectWellFormed = (id: string, plan: ActionPlan): void => {
    const paths = allPaths(plan)
    expect([id, new Set(paths).size]).toEqual([id, paths.length])
    for (const { path, items } of planSteps(plan)) {
        const scoped = items.filter(({ kind }) => kind !== 'step')
        expect([id, scoped.every((item) => item.path.startsWith(`${path}.`) && !item.path.slice(path.length + 1).includes('.'))]).toEqual([id, true])
        expect([id, items.filter(({ kind }) => kind === 'intent').length <= 1]).toEqual([id, true])
        expect([id, orderItems(items)]).toEqual([id, items])
    }
}

describe('the action plan', () => {
    describe('bare handles bracketed (CQ-P5)', () => {
        const handles = ['table1', 'saucer1', 'cup1', 'cup10']
        it.each([
            ['bare handles', 'saucer1 tips with table1', '[saucer1] tips with [table1]'],
            ['bracketed ones left', '[saucer1] tips with table1', '[saucer1] tips with [table1]'],
            ['any case, written as the handle', 'Cup1 slides off Saucer1.', '[cup1] slides off [saucer1].'],
            ['whole words only', 'cup10 and cup1s and mycup1 and cup1', '[cup10] and cup1s and mycup1 and [cup1]'],
            ['punctuation around', '(cup1), saucer1; table1!', '([cup1]), [saucer1]; [table1]!'],
            ['nothing to repair', 'the tea spills', 'the tea spills'],
        ])('%s', (_, text, repaired) => {
            expect(bracketHandles(text, handles)).toBe(repaired)
        })

        it('leaves a text unchanged with no handles', () => {
            expect(bracketHandles('cup1 falls', [])).toBe('cup1 falls')
        })
    })

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

        it('mints against the scope\'s paths already taken: the slug if free, else the first free -n', () => {
            const texts = ['tip [table1]', 'tip [table1]', 'pick up [cup1]'].map((says) => ({ says, fallback: 'step' }))
            expect(mintPaths(texts, ['tip-table1', 'tip-table1-3'])).toEqual(['tip-table1-2', 'tip-table1-4', 'pick-up-cup1'])
        })

        it('keeps a text that slugs to a numbered path apart from a repeat', () => {
            expect(mintPaths(['tip [table1]', 'tip [table1] 2', 'tip [table1]'].map((says) => ({ says, fallback: 'step' }))))
                .toEqual(['tip-table1', 'tip-table1-2', 'tip-table1-3'])
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
                expect([id, plan.steps.map(({ path, items, standing, ...step }) => ({ step, standing, items }))]).toEqual([id, steps.map((step) => ({ step, standing: 'confirmed', items: [] }))])
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
            const actions = ['pick up [saucer1]', 'pour [tea2] from [teapot1] into [cup1]']
            const plan = planFromActions(actions)
            expectWellFormed('actions', plan)
            expect(plan.steps.map(({ says, suppliedBy, items }) => ({ says, suppliedBy, items }))).toEqual(actions.map((says) => ({ says, suppliedBy: 'system', items: [] })))
        })

        it('playByPlay\'s cells: their plans, built by hand', () => {
            for (const [id, { inputs: { plan } }] of Object.entries(playByPlayCells)) {
                expectWellFormed(id, plan)
            }
        })

        it('consequences\' cells: their plans, built by hand', () => {
            for (const [id, { inputs: { plan } }] of Object.entries(consequencesCells)) {
                expectWellFormed(id, plan)
            }
        })

        it('is stable: the same inputs build equal plans', () => {
            for (const { inputs: { steps } } of Object.values(nonRuleCellCells)) {
                expect(planFromNonRuleSteps(steps)).toEqual(planFromNonRuleSteps(steps))
            }
        })
    })

    describe('the trial\'s roles: an intended step folds into the method step before it', () => {
        const intent = { kind: 'intent', path: 'tip-table1.intent', standing: 'confirmed', says: '[teapot1] pours [tea2] into [cup1]' }
        const intendedPour = { kind: 'consequence', path: 'tip-table1.teapot1-pours-tea2', standing: 'confirmed', says: '[teapot1] pours [tea2] into [cup1]', intended: true }
        const tip = { says: 'tip [table1]', suppliedBy: 'system', path: 'tip-table1', standing: 'confirmed', items: [intent, intendedPour] }

        it('h5: the pour folds into the tip as its intent and its intended consequence', () => {
            expect(planFromNonRuleSteps(nonRuleCellCells['OC-30/h5'].inputs.steps)).toEqual({ steps: [tip] })
        })

        it('h7: the slide line follows the intended pour', () => {
            expect(planFromNonRuleSteps(nonRuleCellCells['OC-30/h7'].inputs.steps)).toEqual({ steps: [{
                ...tip, items: [intent, intendedPour, { kind: 'consequence', path: 'tip-table1.saucer1-cup1-slide', standing: 'confirmed', says: '[saucer1] and [cup1] slide off [table1] onto the floor' }],
            }] })
        })

        it('h10: the saucer picked up first, with no items, then the tip as in h5', () => {
            expect(planFromNonRuleSteps(nonRuleCellCells['OC-30/h10'].inputs.steps)).toEqual({ steps: [
                { says: 'pick up [saucer1]', suppliedBy: 'system', path: 'pick-up-saucer1', standing: 'confirmed', items: [] },
                tip,
            ] })
        })

        it('a single intended step stays a step, with an intent of its own text and no intended consequence', () => {
            expect(planFromNonRuleSteps(nonRuleCellCells['OC-2'].inputs.steps)).toEqual({ steps: [
                { says: 'pick up [cup1]', suppliedBy: 'system', path: 'pick-up-cup1', standing: 'confirmed', items: [{ kind: 'intent', path: 'pick-up-cup1.intent', standing: 'confirmed', says: 'pick up [cup1]' }] },
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
            '  - intent tip-table1.intent: [teapot1] pours [tea2] into [cup1]',
            '  - consequence (intended) tip-table1.teapot1-pours-tea2: [teapot1] pours [tea2] into [cup1]',
        ].join('\n'))
        expect(renderPlanForGenerator(planFromNonRuleSteps(nonRuleCellCells['OC-30/h7'].inputs.steps)).split('\n').slice(-1)[0])
            .toBe('  - consequence tip-table1.saucer1-cup1-slide: [saucer1] and [cup1] slide off [table1] onto the floor')
    })

    describe('changes merged in', () => {
        let handles: string[] = []
        beforeAll(async () => {
            handles = Object.keys((await fixtureScene('teaTable')).things)
        })
        const h5 = () => planFromNonRuleSteps(nonRuleCellCells['OC-30/h5'].inputs.steps)
        const h7 = () => planFromNonRuleSteps(nonRuleCellCells['OC-30/h7'].inputs.steps)
        const h10 = () => planFromNonRuleSteps(nonRuleCellCells['OC-30/h10'].inputs.steps)
        const slide = { add: 'consequence', to: 'tip-table1', thing: 'cup1', says: '[cup1] slides off with [saucer1] onto the floor' }
        const spout = { add: 'concern', to: 'tip-table1', says: '[cup1] is no longer under [teapot1]\'s spout' }
        const asConsequences: MergeOptions = { author: 'consequences' }
        const merged = (plan: ActionPlan, changes: unknown[]): ActionPlan => {
            const result = mergeChanges(plan, { changes }, handles, asConsequences)
            if ('problems' in result) {
                throw new Error(result.problems.join('; '))
            }
            return result.plan
        }
        const refused = (plan: ActionPlan, block: unknown): string[] => {
            const result = mergeChanges(plan, block, handles, asConsequences)
            return 'problems' in result ? result.problems : []
        }

        it('h5: the worked example\'s block adds the slide after the intended pour, and the concern last', () => {
            const plan = merged(h5(), [slide, spout])
            expectWellFormed('h5', plan)
            expect(plan.steps[0].items).toEqual([
                { kind: 'intent', path: 'tip-table1.intent', standing: 'confirmed', says: '[teapot1] pours [tea2] into [cup1]' },
                { kind: 'consequence', path: 'tip-table1.teapot1-pours-tea2', standing: 'confirmed', says: '[teapot1] pours [tea2] into [cup1]', intended: true },
                { kind: 'consequence', path: 'tip-table1.cup1-slides-saucer1', standing: 'confirmed', says: '[cup1] slides off with [saucer1] onto the floor', thing: 'cup1' },
                { kind: 'concern', path: 'tip-table1.cup1-no-longer', standing: 'confirmed', says: '[cup1] is no longer under [teapot1]\'s spout' },
            ])
        })

        it('h7: an added consequence follows the slide line, and a concern goes last, in any block order', () => {
            const plan = merged(h7(), [spout, { add: 'consequence', to: 'tip-table1', says: '[teapot1] slides toward the tipped edge' }])
            expectWellFormed('h7', plan)
            expect(plan.steps[0].items.map(({ path }) => path)).toEqual([
                'tip-table1.intent', 'tip-table1.teapot1-pours-tea2', 'tip-table1.saucer1-cup1-slide',
                'tip-table1.teapot1-slides-toward', 'tip-table1.cup1-no-longer',
            ])
        })

        it('h10: an addition on the tip lands after the intended pour, and the saucer\'s step is kept as it is', () => {
            const before = h10()
            const plan = merged(before, [{ add: 'consequence', to: 'tip-table1', thing: '[teapot1]', says: '[teapot1] slides toward the tipped edge' }])
            expectWellFormed('h10', plan)
            expect(plan.steps[0]).toBe(before.steps[0])
            expect(plan.steps[1].items.slice(-1)).toEqual([
                { kind: 'consequence', path: 'tip-table1.teapot1-slides-toward', standing: 'confirmed', says: '[teapot1] slides toward the tipped edge', thing: 'teapot1' },
            ])
        })

        it('h10: a block that addresses a step not in the plan is refused whole', () => {
            expect(mergeChanges(h10(), { changes: [slide, { ...spout, to: 'pick-up-cup1' }] }, handles, asConsequences)).toEqual({ problems: ['change 2: to "pick-up-cup1" names no step'] })
        })

        it('gives a path that slugs as an existing item\'s the next free -n', () => {
            const plan = merged(h5(), [{ add: 'consequence', to: 'tip-table1', says: '[teapot1] pours [tea2] over [saucer1]' }])
            expect(plan.steps[0].items.map(({ path }) => path).slice(-1)).toEqual(['tip-table1.teapot1-pours-tea2-2'])
        })

        it('leaves the plan it is given unchanged, and an empty block gives an equal plan', () => {
            const plan = h5()
            const copy = JSON.parse(JSON.stringify(plan))
            merged(plan, [slide, spout])
            expect(plan).toEqual(copy)
            expect(merged(plan, [])).toEqual(plan)
        })

        describe('refuses the whole block, saying why', () => {
            it.each([
                ['no object', 'tip', ['the change block is not an object']],
                ['no changes array', { changes: 'none' }, ['the JSON block has no "changes" array']],
                ['a change that is not an object', { changes: ['add it'] }, ['change 1: is not an object']],
                ['no says', { changes: [{ add: 'concern', to: 'tip-table1', says: ' ' }] }, ['change 1: has no non-empty string "says"']],
                ['an unknown key', { changes: [{ ...spout, why: 'it tips' }] }, ['change 1: has "why", not one of add, to, thing, says']],
                ['intended', { changes: [{ ...slide, intended: true }] }, ['change 1: "intended" isn\'t writable: a change adds only unintended consequences']],
                ['an unknown kind', { changes: [{ ...spout, add: 'intent' }] }, ['change 1: "add" must be one of consequence, concern, possibility']],
                ['no such step', { changes: [{ ...spout, to: 'tip-teapot1' }] }, ['change 1: to "tip-teapot1" names no step']],
                ['a sub-item named', { changes: [{ ...spout, to: 'tip-table1.teapot1-pours-tea2' }] }, ['change 1: to "tip-table1.teapot1-pours-tea2" names a sub-item, not a step']],
                ['a thing not in the scene', { changes: [{ ...slide, thing: '[mug1]' }] }, ['change 1: thing "mug1" is not in the scene']],
                ['a thing on a concern', { changes: [{ ...spout, thing: 'cup1' }] }, ['change 1: a concern takes no "thing"']],
            ])('%s', (_, block, problems) => {
                expect(refused(h5(), block)).toEqual(problems)
            })

            it('lists every problem in the block', () => {
                expect(refused(h5(), { changes: [slide, { add: 'note', to: 'tip', says: '' }, { ...spout, thing: 'mug1' }] })).toEqual([
                    'change 2: "add" must be one of consequence, concern, possibility',
                    'change 2: to "tip" names no step',
                    'change 2: has no non-empty string "says"',
                    'change 3: thing "mug1" is not in the scene',
                    'change 3: a concern takes no "thing"',
                ])
            })
        })

        describe('scoped to one step, with `to` supplied', () => {
            const unscoped = ({ to, ...change }: Record<string, unknown>) => change
            const scoped = (plan: ActionPlan, target: string, block: unknown) => mergeStepChanges(plan, target, block, handles, asConsequences)

            it('fills each change\'s missing `to` with the target, and merges as mergeChanges does', () => {
                expect(scoped(h5(), 'tip-table1', { changes: [unscoped(slide), unscoped(spout)] })).toEqual({ plan: merged(h5(), [slide, spout]) })
            })

            it('passes a written `to` that names the target', () => {
                expect(scoped(h5(), 'tip-table1', { changes: [slide, unscoped(spout)] })).toEqual({ plan: merged(h5(), [slide, spout]) })
            })

            it('adds only to the target, leaving the other steps as they were', () => {
                const result = scoped(h10(), 'tip-table1', { changes: [unscoped(slide)] })
                expect(result).toEqual({ plan: merged(h10(), [slide]) })
                expect('plan' in result && result.plan.steps[0]).toEqual(h10().steps[0])
            })

            it('refuses the block on a `to` naming another step or a sub-item, with every problem', () => {
                expect(scoped(h10(), 'tip-table1', { changes: [{ ...slide, to: 'pick-up-saucer1' }, { ...spout, to: 'tip-table1.teapot1-pours-tea2' }, { ...spout, to: 3 }] })).toEqual({ problems: [
                    'change 1: to "pick-up-saucer1" is not the step being expanded, tip-table1',
                    'change 2: to "tip-table1.teapot1-pours-tea2" is not the step being expanded, tip-table1',
                    'change 3: to 3 is not the step being expanded, tip-table1',
                ] })
            })

            it('refuses a key beside "changes", with the other problems', () => {
                expect(mergeChanges(h5(), { changes: [slide], concerns: [spout] }, handles, asConsequences)).toEqual({ problems: ['the JSON block has "concerns"; everything it adds goes in "changes"'] })
                expect(mergeChanges(h5(), { concerns: [spout] }, handles, asConsequences)).toEqual({ problems: ['the JSON block has no "changes" array', 'the JSON block has "concerns"; everything it adds goes in "changes"'] })
            })

            it('names its handles in a refusal as the caller says', () => {
                expect(mergeChanges(h5(), { changes: [{ ...slide, thing: 'mug1' }] }, handles, { author: 'consequences', handlesAre: 'a listed thing' })).toEqual({ problems: ['change 1: thing "mug1" is not a listed thing'] })
            })

            it('leaves the other problems to mergeChanges', () => {
                expect(scoped(h5(), 'tip-table1', { actions: [] })).toEqual({ problems: ['the JSON block has no "changes" array', 'the JSON block has "actions"; everything it adds goes in "changes"'] })
                expect(scoped(h5(), 'tip-table1', { changes: [{ add: 'remove', says: 'x' }] })).toEqual({ problems: ['change 1: "add" must be one of consequence, concern, possibility'] })
            })

            it('throws on a target that names no step', () => {
                expect(() => scoped(h5(), 'tip-table1.teapot1-pours-tea2', { changes: [] })).toThrow(/names no step/)
            })
        })

        describe('the contract', () => {
            it('parses a reply\'s fenced block into the merged plan', () => {
                const reply = ['Tipping the table moves the cup.', '', '```json', JSON.stringify({ changes: [slide, spout] }), '```'].join('\n')
                expect(planChangesContract.parse(reply, { input: { plan: h5(), handles, author: 'consequences' }, rendered: '' })).toEqual({ value: merged(h5(), [slide, spout]) })
            })

            it('gives the form problem of a reply with no block', () => {
                expect(planChangesContract.parse('Nothing changes.', { input: { plan: h5(), handles, author: 'consequences' }, rendered: '' })).toEqual({ problems: ['no JSON block'] })
            })
        })

        describe('possibilities', () => {
            // The expand form's target: the step holding its intent alone, as consequences' OC-30/2 cell does.
            const tip = () => planOf([{ step: { says: 'tip [table1]', suppliedBy: 'system' }, items: [{ kind: 'intent', says: '[teapot1] pours [tea2] into [cup1]' }] }])
            const pours = { thing: '[teapot1]', says: '[teapot1] pours [tea2] into [cup1]' }
            const slides = { thing: '[saucer1]', says: '[saucer1] and [cup1] slide off and fall to the floor' }
            const spills = { thing: '[tea2]', says: '[tea2] spills' }
            const execution = { add: 'possibility', to: 'tip-table1', kind: 'execution', says: 'tipping [table1] only far enough to pour without sliding [saucer1] off', branches: [[pours], [slides, spills]] }

            it('merges the design\'s shape example, every path flat under the step and minted in its one scope', () => {
                const plan = merged(tip(), [execution])
                expectWellFormed('tip', plan)
                expect(plan.steps[0].items).toEqual([
                    { kind: 'intent', path: 'tip-table1.intent', standing: 'confirmed', says: '[teapot1] pours [tea2] into [cup1]' },
                    { kind: 'possibility', path: 'tip-table1.execution', standing: 'confirmed', openness: 'execution', says: execution.says, branches: [
                        { kind: 'maybe', path: 'tip-table1.maybe', items: [{ kind: 'consequence', path: 'tip-table1.teapot1-pours-tea2', thing: 'teapot1', says: pours.says }] },
                        { kind: 'maybe', path: 'tip-table1.maybe-2', items: [
                            { kind: 'consequence', path: 'tip-table1.saucer1-cup1-slide', thing: 'saucer1', says: slides.says },
                            { kind: 'consequence', path: 'tip-table1.tea2-spills', thing: 'tea2', says: spills.says },
                        ] },
                    ] },
                ])
            })

            it('renders it nested, one indent per level, as the design\'s example', () => {
                expect(renderPlanForGenerator(merged(tip(), [execution]))).toBe([
                    'Step tip-table1: tip [table1]',
                    '  - intent tip-table1.intent: [teapot1] pours [tea2] into [cup1]',
                    '  - possibility (execution) tip-table1.execution: tipping [table1] only far enough to pour without sliding [saucer1] off',
                    '    - maybe tip-table1.maybe:',
                    '      - consequence tip-table1.teapot1-pours-tea2: [teapot1] pours [tea2] into [cup1]',
                    '    - maybe tip-table1.maybe-2:',
                    '      - consequence tip-table1.saucer1-cup1-slide: [saucer1] and [cup1] slide off and fall to the floor',
                    '      - consequence tip-table1.tea2-spills: [tea2] spills',
                ].join('\n'))
            })

            it('places a flat consequence (every branch) before the possibility, and a concern after it, in any block order', () => {
                const tilts = { add: 'consequence', to: 'tip-table1', thing: 'table1', says: '[table1] tilts' }
                const plan = merged(tip(), [spout, execution, tilts])
                expect(plan.steps[0].items.map(({ kind, path }) => `${kind} ${path}`)).toEqual([
                    'intent tip-table1.intent', 'consequence tip-table1.table1-tilts', 'possibility tip-table1.execution', 'concern tip-table1.cup1-no-longer',
                ])
            })

            it('allows an empty branch: nothing happens is an outcome', () => {
                const plan = merged(tip(), [{ ...execution, branches: [[pours], []] }])
                expect(renderPlanForGenerator(plan).split('\n').slice(-2)).toEqual([
                    '      - consequence tip-table1.teapot1-pours-tea2: [teapot1] pours [tea2] into [cup1]',
                    '    - maybe tip-table1.maybe-2:',
                ])
            })

            it('takes `add: "consequence"` on a branch entry, written as a flat one is', () => {
                expect(merged(tip(), [{ ...execution, branches: [[{ add: 'consequence', ...pours }], [slides]] }])).toEqual(merged(tip(), [{ ...execution, branches: [[pours], [slides]] }]))
            })

            it('mints a later addition against every path the step holds, branches included', () => {
                const plan = merged(merged(tip(), [execution]), [{ add: 'consequence', to: 'tip-table1', says: '[tea2] spills' }])
                expect(plan.steps[0].items[1]).toEqual({ kind: 'consequence', path: 'tip-table1.tea2-spills-2', standing: 'confirmed', says: '[tea2] spills' })
                expectWellFormed('tip, twice', plan)
            })

            it.each([
                ['one branch', { changes: [{ ...execution, branches: [[pours]] }] }, ['change 1: has 1 branch; a possibility needs at least two']],
                ['no branches list', { changes: [{ ...execution, branches: undefined }] }, ['change 1: has no "branches" list']],
                ['a branch that is not a list', { changes: [{ ...execution, branches: [[pours], pours] }] }, ['change 1: branch 2 is not a list']],
                ['a concern in a branch', { changes: [{ ...execution, branches: [[pours], [{ add: 'concern', says: 'x' }]] }] }, ['change 1: branch 2, entry 1: a branch holds no concern: a branch in which the intent fails already is one']],
                ['a `to` in a branch entry', { changes: [{ ...execution, branches: [[pours], [{ ...slides, to: 'tip-table1' }]] }] }, ['change 1: branch 2, entry 1: has "to", not one of add, thing, says']],
                ['a branch entry with no says', { changes: [{ ...execution, branches: [[pours], [{ thing: 'saucer1' }]] }] }, ['change 1: branch 2, entry 1: has no non-empty string "says"']],
                ['a thing not in the scene, in a branch', { changes: [{ ...execution, branches: [[pours], [{ ...slides, thing: 'mug1' }]] }] }, ['change 1: branch 2, entry 1: thing "mug1" is not in the scene']],
                ['an unknown kind of openness', { changes: [{ ...execution, kind: 'unestablished' }] }, ['change 1: "kind" must be one of execution']],
                ['no kind', { changes: [{ ...execution, kind: undefined }] }, ['change 1: "kind" must be one of execution']],
                ['a thing on the possibility', { changes: [{ ...execution, thing: 'table1' }] }, ['change 1: has "thing", not one of add, to, kind, says, branches']],
                ['no condition', { changes: [{ ...execution, says: '' }] }, ['change 1: has no non-empty string "says"']],
                ['two execution possibilities in one block', { changes: [execution, execution] }, ['change 2: step tip-table1 already has an execution possibility; a step holds at most one']],
            ])('refuses the whole block on %s', (_, block, problems) => {
                expect(refused(tip(), block)).toEqual(problems)
            })

            it('refuses an execution possibility on a step that already holds one', () => {
                expect(refused(merged(tip(), [execution]), { changes: [execution] })).toEqual(['change 1: step tip-table1 already has an execution possibility; a step holds at most one'])
            })

            it('refuses a `to` naming a branch or a branch\'s consequence: they are sub-items', () => {
                expect(refused(merged(tip(), [execution]), { changes: [{ ...spout, to: 'tip-table1.maybe-2' }, { ...spout, to: 'tip-table1.tea2-spills' }] })).toEqual([
                    'change 1: to "tip-table1.maybe-2" names a sub-item, not a step',
                    'change 2: to "tip-table1.tea2-spills" names a sub-item, not a step',
                ])
            })

            it('is scoped like any change: code supplies `to`', () => {
                const { to: _, ...unaddressed } = execution
                expect(mergeStepChanges(tip(), 'tip-table1', { changes: [unaddressed] }, handles, asConsequences)).toEqual({ plan: merged(tip(), [execution]) })
            })
        })

        describe('expansions and restatements (the step record)', () => {
            const POUR = 'pour [tea2] from [teapot1] into [cup1]'
            const pour = () => planOf([{ step: { says: POUR, suppliedBy: 'system' }, items: [{ kind: 'intent', says: POUR }] }])
            const lift = { says: 'lift [teapot1] off [table1]', intent: '[teapot1] is held above [cup1]' }
            const tilt = { says: 'tilt [teapot1] over [cup1]', intent: '[tea2] pours into [cup1]' }
            const expand = { add: 'steps', to: 'pour-tea2-teapot1', steps: [lift, tilt] }
            const ANSWERED = 'how [teapot1] is held'
            const restate = { restate: 'step', to: 'pour-tea2-teapot1', says: POUR, intent: POUR, answered: ANSWERED }
            const takes: MergeOptions = { author: 'playByPlay', adds: ['steps'], restates: true }
            const restating: MergeOptions = { author: 'playByPlay', adds: ['steps', 'consequence'], restates: true }
            const spills = { add: 'consequence', to: 'pour-tea2-teapot1', says: '[tea2] spills over [table1]' }
            const expanded = (plan: ActionPlan, changes: unknown[], options: MergeOptions = takes): ActionPlan => {
                const result = mergeChanges(plan, { changes }, handles, options)
                if ('problems' in result) {
                    throw new Error(result.problems.join('; '))
                }
                return result.plan
            }
            const refusedWith = (plan: ActionPlan, changes: unknown[], options: MergeOptions = takes): string[] => {
                const result = mergeChanges(plan, { changes }, handles, options)
                return 'problems' in result ? result.problems : []
            }

            it('expands a step in place: its path and items kept, each sub-step a flat step path with its intent, after the intent', () => {
                const plan = expanded(pour(), [expand])
                expect(plan.steps).toEqual([{ says: POUR, suppliedBy: 'system', path: 'pour-tea2-teapot1', standing: 'confirmed', items: [
                    { kind: 'intent', path: 'pour-tea2-teapot1.intent', standing: 'confirmed', says: POUR },
                    { kind: 'step', path: 'lift-teapot1-table1', standing: 'confirmed', says: lift.says, suppliedBy: 'system', items: [{ kind: 'intent', path: 'lift-teapot1-table1.intent', standing: 'confirmed', says: lift.intent }] },
                    { kind: 'step', path: 'tilt-teapot1-over', standing: 'confirmed', says: tilt.says, suppliedBy: 'system', items: [{ kind: 'intent', path: 'tilt-teapot1-over.intent', standing: 'confirmed', says: tilt.intent }] },
                ] }])
            })

            it('renders it as the design\'s OC-6 example, a sub-step\'s items indented under it', () => {
                expect(renderPlanForGenerator(expanded(pour(), [expand]))).toBe([
                    'Step pour-tea2-teapot1: pour [tea2] from [teapot1] into [cup1]',
                    '  - intent pour-tea2-teapot1.intent: pour [tea2] from [teapot1] into [cup1]',
                    '  - step lift-teapot1-table1: lift [teapot1] off [table1]',
                    '    - intent lift-teapot1-table1.intent: [teapot1] is held above [cup1]',
                    '  - step tilt-teapot1-over: tilt [teapot1] over [cup1]',
                    '    - intent tilt-teapot1-over.intent: [tea2] pours into [cup1]',
                ].join('\n'))
            })

            it('takes a sub-step with no intent, and one naming a thing the scene doesn\'t hold (an improvised object)', () => {
                const plan = expanded(pour(), [{ ...expand, steps: [{ says: 'slide [cloth1] under [teapot1]' }, tilt] }])
                expect(plan.steps[0].items[1]).toEqual({ kind: 'step', path: 'slide-cloth1-under', standing: 'confirmed', says: 'slide [cloth1] under [teapot1]', suppliedBy: 'system', items: [] })
            })

            it('expands a sub-step in turn, minting against the step paths at every depth', () => {
                const once = expanded(pour(), [expand])
                const twice = expanded(once, [{ add: 'steps', to: 'lift-teapot1-table1', steps: [{ says: 'grasp [teapot1]' }, { says: 'lift [teapot1] off [table1]' }, { says: POUR }] }])
                expect(planSteps(twice).map(({ path }) => path)).toEqual([
                    'pour-tea2-teapot1', 'lift-teapot1-table1', 'grasp-teapot1', 'lift-teapot1-table1-2', 'pour-tea2-teapot1-2', 'tilt-teapot1-over',
                ])
                expect(renderPlanForGenerator(twice).split('\n').slice(2, 7)).toEqual([
                    '  - step lift-teapot1-table1: lift [teapot1] off [table1]',
                    '    - intent lift-teapot1-table1.intent: [teapot1] is held above [cup1]',
                    '    - step grasp-teapot1: grasp [teapot1]',
                    '    - step lift-teapot1-table1-2: lift [teapot1] off [table1]',
                    '    - step pour-tea2-teapot1-2: pour [tea2] from [teapot1] into [cup1]',
                ])
            })

            it('adds a consequence aimed at a sub-step in that sub-step\'s own scope, after its intent', () => {
                const plan = expanded(expanded(pour(), [expand]), [{ add: 'consequence', to: 'lift-teapot1-table1', says: '[teapot1] rises' }], asConsequences)
                const sub = planSteps(plan).find(({ path }) => path === 'lift-teapot1-table1')
                expect(sub?.items).toEqual([
                    { kind: 'intent', path: 'lift-teapot1-table1.intent', standing: 'confirmed', says: lift.intent },
                    { kind: 'consequence', path: 'lift-teapot1-table1.teapot1-rises', standing: 'confirmed', says: '[teapot1] rises' },
                ])
            })

            it('keeps the other steps as they were, and leaves the plan it is given unchanged', () => {
                const before = planOf([{ step: { says: 'pick up [saucer1]', suppliedBy: 'system' }, items: [] }, { step: { says: POUR, suppliedBy: 'system' }, items: [] }])
                const copy = JSON.parse(JSON.stringify(before))
                const plan = expanded(before, [expand])
                expect(plan.steps[0]).toBe(before.steps[0])
                expect(before).toEqual(copy)
            })

            it('restates a step as written: its path and items kept, the detail asked for added to its alreadyAnswers, rendered first under it', () => {
                const before = expanded(pour(), [spills], asConsequences)
                const plan = expanded(before, [restate], restating)
                expect(plan.steps[0]).toEqual({ ...before.steps[0], alreadyAnswers: [ANSWERED] })
                expect(renderPlanForGenerator(plan).split('\n').slice(0, 2)).toEqual(['Step pour-tea2-teapot1: pour [tea2] from [teapot1] into [cup1]', '  - already answers: how [teapot1] is held'])
            })

            it('adds a detail once, keeping the ones before it', () => {
                const once = expanded(pour(), [restate])
                expect(expanded(once, [restate]).steps[0].alreadyAnswers).toEqual([ANSWERED])
                expect(expanded(once, [{ ...restate, answered: 'how [cup1] is held' }]).steps[0].alreadyAnswers).toEqual([ANSWERED, 'how [cup1] is held'])
            })

            it('revises on a changed intent: the path kept, the intent the restatement\'s, a consequence given again by the reviser kept unchecked and stale', () => {
                const before = expanded(pour(), [spills], asConsequences)
                const plan = expanded(before, [{ ...restate, intent: '[tea2] is in [cup1]' }, spills], restating)
                expect(plan.steps).toEqual([{ says: POUR, suppliedBy: 'system', path: 'pour-tea2-teapot1', standing: 'confirmed', alreadyAnswers: [ANSWERED], items: [
                    { kind: 'intent', path: 'pour-tea2-teapot1.intent', standing: 'confirmed', says: '[tea2] is in [cup1]' },
                    { kind: 'consequence', path: 'pour-tea2-teapot1.tea2-spills-over', standing: 'unchecked', stale: true, says: '[tea2] spills over [table1]' },
                ] }])
            })

            it('revises on a changed says: a path minted afresh before the sub-steps\', the old intent kept under it when none is given', () => {
                const command = planOf([{ step: { says: 'pour tea into cup', suppliedBy: 'system' }, items: [{ kind: 'intent', says: 'pour tea into cup' }] }])
                const plan = expanded(command, [
                    { restate: 'step', to: 'pour-tea-cup', says: POUR, answered: 'how the tea is poured' },
                    { add: 'steps', to: 'pour-tea-cup', steps: [lift, { says: POUR }] },
                ])
                expectWellFormed('revised', plan)
                expect(planSteps(plan).map(({ path, says }) => [path, says])).toEqual([['pour-tea2-teapot1', POUR], ['lift-teapot1-table1', lift.says], ['pour-tea2-teapot1-2', POUR]])
                expect(plan.steps[0]).toMatchObject({ path: 'pour-tea2-teapot1', says: POUR, standing: 'confirmed', alreadyAnswers: ['how the tea is poured'] })
                expect(plan.steps[0].items[0]).toEqual({ kind: 'intent', path: 'pour-tea2-teapot1.intent', standing: 'confirmed', says: 'pour tea into cup' })
            })

            it('keeps the path of a changed says that slugs the same, as a replacement does', () => {
                const plan = expanded(pour(), [{ ...restate, says: `${POUR} slowly` }])
                expect(plan.steps[0]).toMatchObject({ path: 'pour-tea2-teapot1', says: `${POUR} slowly`, items: [{ kind: 'intent', path: 'pour-tea2-teapot1.intent', says: POUR }] })
            })

            it('revises a sub-step in its place, its parent and siblings as they were', () => {
                const once = expanded(pour(), [expand])
                const plan = expanded(once, [{ restate: 'step', to: 'tilt-teapot1-over', says: 'tip [teapot1] over [cup1]', answered: 'how [teapot1] is tipped' }])
                expect(planSteps(plan).map(({ path }) => path)).toEqual(['pour-tea2-teapot1', 'lift-teapot1-table1', 'tip-teapot1-over'])
                expect(planSteps(plan)[2]).toEqual({
                    kind: 'step', path: 'tip-teapot1-over', standing: 'confirmed', says: 'tip [teapot1] over [cup1]', suppliedBy: 'system', alreadyAnswers: ['how [teapot1] is tipped'],
                    items: [{ kind: 'intent', path: 'tip-teapot1-over.intent', standing: 'confirmed', says: tilt.intent }],
                })
                expect(renderPlanForGenerator(plan).split('\n').slice(4)).toEqual([
                    '  - step tip-teapot1-over: tip [teapot1] over [cup1]', '    - already answers: how [teapot1] is tipped', '    - intent tip-teapot1-over.intent: [tea2] pours into [cup1]',
                ])
            })

            it('is scoped like any change: code supplies `to` to an expansion and to a restatement', () => {
                expect(mergeStepChanges(pour(), 'pour-tea2-teapot1', { changes: [{ add: 'steps', steps: [lift, tilt] }] }, handles, takes)).toEqual({ plan: expanded(pour(), [expand]) })
                const { to: _, ...unaddressed } = restate
                expect(mergeStepChanges(pour(), 'pour-tea2-teapot1', { changes: [unaddressed] }, handles, takes)).toEqual({ plan: expanded(pour(), [restate]) })
                const once = expanded(pour(), [expand])
                expect(mergeStepChanges(once, 'tilt-teapot1-over', { changes: [{ ...unaddressed, says: tilt.says }] }, handles, takes)).toEqual({ plan: expanded(once, [{ ...restate, to: 'tilt-teapot1-over', says: tilt.says }]) })
            })

            it('is refused by default, so a block takes the sub-item kinds unless told otherwise', () => {
                expect(refusedWith(pour(), [expand], { author: 'playByPlay' })).toEqual(['change 1: "add" must be one of consequence, concern, possibility'])
                expect(refusedWith(pour(), [restate], { author: 'playByPlay' })).toEqual(['change 1: "restate" isn\'t a change this block takes'])
                expect(refusedWith(pour(), [{ add: 'consequence', to: 'pour-tea2-teapot1', says: '[teapot1] tilts' }])).toEqual(['change 1: "add" must be one of steps'])
            })

            it.each([
                ['a single sub-step', [{ ...expand, steps: [lift] }], ['change 1: has 1 sub-step; an expansion needs at least two']],
                ['no steps list', [{ ...expand, steps: 'lift it' }], ['change 1: has no "steps" list']],
                ['a sub-step that is not an object', [{ ...expand, steps: [lift, 'tilt'] }], ['change 1: sub-step 2: is not an object']],
                ['a sub-step with no says', [{ ...expand, steps: [lift, { intent: 'it pours' }] }], ['change 1: sub-step 2: has no non-empty string "says"']],
                ['a sub-step with another key', [{ ...expand, steps: [lift, { ...tilt, thing: 'cup1' }] }], ['change 1: sub-step 2: has "thing", not one of says, intent, consequences']],
                ['a blank intent', [{ ...expand, steps: [lift, { ...tilt, intent: ' ' }] }], ['change 1: sub-step 2: "intent" is not a non-empty string']],
                ['an expansion with its own says', [{ ...expand, says: 'pour it' }], ['change 1: has "says", not one of add, to, steps']],
                ['an expansion twice in one block', [expand, expand], ['change 2: step pour-tea2-teapot1 is already expanded; expand one of its sub-steps for more detail']],
                ['the retired atomic mark', [{ mark: 'atomic', to: 'pour-tea2-teapot1' }], ['change 1: has "mark", not one of add, to, thing, says', 'change 1: "add" must be one of steps', 'change 1: has no non-empty string "says"']],
                ['a restatement with no says', [{ ...restate, says: ' ' }], ['change 1: has no non-empty string "says"']],
                ['a restatement with a blank intent', [{ ...restate, intent: '' }], ['change 1: "intent" is not a non-empty string']],
                ['a restatement with no detail answered', [{ ...restate, answered: '' }], ['change 1: has no non-empty string "answered"']],
                ['a restatement with another key', [{ ...restate, why: 'simple' }], ['change 1: has "why", not one of restate, to, says, intent, answered']],
                ['a restatement of another kind', [{ ...restate, restate: 'intent' }], ['change 1: "restate" must be step']],
                ['a restatement twice in one block', [restate, restate], ['change 2: step pour-tea2-teapot1 is already restated in this block']],
            ])('refuses %s', (_, changes, problems) => {
                expect(refusedWith(pour(), changes)).toEqual(problems)
            })

            it('refuses against what the plan already holds', () => {
                const once = expanded(pour(), [expand])
                expect(refusedWith(once, [expand])).toEqual(['change 1: step pour-tea2-teapot1 is already expanded; expand one of its sub-steps for more detail'])
                expect(refusedWith(once, [{ ...restate, intent: '[tea2] is in [cup1]' }])).toEqual(['change 1: step pour-tea2-teapot1 is expanded, so it isn\'t revised; revise one of its sub-steps'])
                expect(expanded(once, [restate]).steps[0].alreadyAnswers).toEqual([ANSWERED])
                expect(refusedWith(once, [{ ...expand, to: 'lift-teapot1-table1.intent' }])).toEqual(['change 1: to "lift-teapot1-table1.intent" names a sub-item, not a step'])
            })

            it('takes a replacement aimed at an item of a step the block revises: the item stays, so it is replaced, under the new path when the path moves', () => {
                const proposed = expanded(pour(), [spills], { author: 'playByPlay', adds: ['consequence'] })
                const replace = { replace: 'pour-tea2-teapot1.tea2-spills-over', with: { says: '[tea2] stays in [teapot1]' } }
                const checking: MergeOptions = { author: 'consequences', restates: true, replaces: true }
                const kept = expanded(proposed, [{ ...restate, intent: '[tea2] is in [cup1]' }, replace], checking)
                expect(kept.steps[0].items[1]).toEqual({ kind: 'consequence', path: 'pour-tea2-teapot1.tea2-stays-in', standing: 'confirmed', says: '[tea2] stays in [teapot1]' })
                const moved = expanded(proposed, [{ ...restate, says: 'tip [teapot1] over [cup1]' }, replace], checking)
                expect(moved.steps[0].items[1]).toMatchObject({ path: 'tip-teapot1-over.tea2-stays-in', standing: 'confirmed' })
            })

            it('brackets bare handles in a sub-step\'s says and intent', () => {
                expect(bracketChanges({ changes: [{ add: 'steps', steps: [{ says: 'lift teapot1', intent: 'teapot1 is up' }, 'x'] }] }, ['teapot1'])).toEqual({
                    changes: [{ add: 'steps', steps: [{ says: 'lift [teapot1]', intent: '[teapot1] is up' }, 'x'] }],
                })
            })
        })

        describe('standing, rules and replace', () => {
            const RULES = ['table-secured-to-wall', 'teapot-secured-to-table']
            const pickUp = () => planOf([{ step: { says: 'pick up [table1]', suppliedBy: 'system' }, items: [{ kind: 'intent', says: 'pick up [table1]' }] }])
            const chain = { rule: '[table-secured-to-wall]', stance: 'violation' }
            const oc20 = {
                add: 'steps', to: 'pick-up-table1', steps: [
                    { says: 'grip [table1] by its edges', intent: '[table1] is held firmly' },
                    { says: 'lift [table1] straight up', intent: '[table1] rises off the floor', consequences: [{ says: '[table1] pulls away from [wall1]', thing: '[table1]', rules: [chain] }] },
                ],
            }
            const cannot = { add: 'consequence', to: 'pick-up-table1', says: '[table1] cannot be lifted', rules: [chain] }
            const by = (author: MergeOptions['author'], extra: Partial<MergeOptions> = {}): MergeOptions => ({ author, adds: ['steps', 'consequence', 'concern'], restates: true, rules: RULES, ...extra })
            const mergedBy = (plan: ActionPlan, changes: unknown[], options: MergeOptions): ActionPlan => {
                const result = mergeChanges(plan, { changes }, handles, options)
                if ('problems' in result) {
                    throw new Error(result.problems.join('; '))
                }
                return result.plan
            }
            const refusedBy = (plan: ActionPlan, changes: unknown[], options: MergeOptions): string[] => {
                const result = mergeChanges(plan, { changes }, handles, options)
                return 'problems' in result ? result.problems : []
            }
            const conceded = () => mergedBy(pickUp(), [cannot], by('playByPlay'))

            describe('an intent built unchecked: divined from a command, an offer until its authority restates it (the user, 2026-11-20)', () => {
                const divined = () => planOf([{ step: { says: 'pick up [table1]', suppliedBy: 'system' }, items: [{ kind: 'intent', says: 'pick up [table1]', standing: 'unchecked' }] }])
                const restate = { restate: 'step', to: 'pick-up-table1', says: 'pick up [table1]', answered: 'how [table1] is held' }
                const intentOf = (plan: ActionPlan) => plan.steps[0].items.find(({ kind }) => kind === 'intent')

                it('builds and renders with its tag; the default stays confirmed', () => {
                    expect(intentOf(divined())).toMatchObject({ path: 'pick-up-table1.intent', standing: 'unchecked' })
                    expect(renderPlanForGenerator(divined()).split('\n')[1]).toBe('  - intent pick-up-table1.intent (unchecked): pick up [table1]')
                    expect(intentOf(pickUp())).toMatchObject({ standing: 'confirmed' })
                })

                it('a restatement as written, giving the intent, confirms it by its authority, path kept (as replace with the item as written)', () => {
                    expect(intentOf(mergedBy(divined(), [{ ...restate, intent: 'pick up [table1]' }], by('playByPlay')))).toEqual({ kind: 'intent', path: 'pick-up-table1.intent', standing: 'confirmed', says: 'pick up [table1]' })
                })

                it('a restatement leaving the intent out says nothing of it: unchecked still', () => {
                    expect(intentOf(mergedBy(divined(), [restate], by('playByPlay')))).toMatchObject({ standing: 'unchecked' })
                })

                it('a changed intent revises the step, its intent the author\'s, confirmed', () => {
                    expect(intentOf(mergedBy(divined(), [{ ...restate, intent: '[table1] is off the floor' }], by('playByPlay')))).toEqual({ kind: 'intent', path: 'pick-up-table1.intent', standing: 'confirmed', says: '[table1] is off the floor' })
                })

                it('a restatement by another author leaves it unchecked: only its authority confirms it', () => {
                    expect(intentOf(mergedBy(divined(), [{ ...restate, intent: 'pick up [table1]' }], by('consequences')))).toMatchObject({ standing: 'unchecked' })
                })
            })

            it('builders confirm every step and item: a plan\'s source is the authority for it', () => {
                const plan = planFromNonRuleSteps(nonRuleCellCells['OC-30/h7'].inputs.steps)
                expect(plan.steps.every(({ standing, items }) => standing === 'confirmed' && items.every((item) => item.standing === 'confirmed'))).toBe(true)
            })

            it('sets each standing from the author and the authority map: playByPlay\'s sub-steps and intents confirmed, its consequences and rules unchecked (OC-20)', () => {
                const plan = mergedBy(pickUp(), [oc20], by('playByPlay'))
                expectWellFormed('OC-20', plan)
                const lift = planSteps(plan).find(({ path }) => path === 'lift-table1-straight')
                expect(lift).toEqual({ kind: 'step', path: 'lift-table1-straight', standing: 'confirmed', says: 'lift [table1] straight up', suppliedBy: 'system', items: [
                    { kind: 'intent', path: 'lift-table1-straight.intent', standing: 'confirmed', says: '[table1] rises off the floor' },
                    { kind: 'consequence', path: 'lift-table1-straight.table1-pulls-away', standing: 'unchecked', says: '[table1] pulls away from [wall1]', thing: 'table1', rules: [
                        { kind: 'rule', path: 'lift-table1-straight.table-secured-to-wall', standing: 'unchecked', rule: 'table-secured-to-wall', stance: 'violation' },
                    ] },
                ] })
            })

            it('renders R1 as step 0\'s OC-20 example: (unchecked) after the path, a rule under its consequence', () => {
                expect(renderPlanForGenerator(mergedBy(pickUp(), [oc20], by('playByPlay')))).toBe([
                    'Step pick-up-table1: pick up [table1]',
                    '  - intent pick-up-table1.intent: pick up [table1]',
                    '  - step grip-table1-by: grip [table1] by its edges',
                    '    - intent grip-table1-by.intent: [table1] is held firmly',
                    '  - step lift-table1-straight: lift [table1] straight up',
                    '    - intent lift-table1-straight.intent: [table1] rises off the floor',
                    '    - consequence lift-table1-straight.table1-pulls-away (unchecked): [table1] pulls away from [wall1]',
                    '      - Rule (Violation) lift-table1-straight.table-secured-to-wall (unchecked): [table-secured-to-wall]',
                ].join('\n'))
            })

            it('renders the concession cell\'s plan as step 0\'s example, and a causes stance as such', () => {
                expect(renderPlanForGenerator(conceded())).toBe([
                    'Step pick-up-table1: pick up [table1]',
                    '  - intent pick-up-table1.intent: pick up [table1]',
                    '  - consequence pick-up-table1.table1-cannot-be (unchecked): [table1] cannot be lifted',
                    '    - Rule (Violation) pick-up-table1.table-secured-to-wall (unchecked): [table-secured-to-wall]',
                ].join('\n'))
                const carry = mergedBy(pickUp(), [{ add: 'consequence', to: 'pick-up-table1', says: '[teapot1] rises with [table1]', rules: [{ rule: 'teapot-secured-to-table', stance: 'causes' }] }], by('playByPlay'))
                expect(renderPlanForGenerator(carry).split('\n').slice(-1)).toEqual(['    - Rule (Causes) pick-up-table1.teapot-secured-to-table (unchecked): [teapot-secured-to-table]'])
            })

            it('merges and renders a voids stance: the consequence ends the rule', () => {
                const loose = mergedBy(pickUp(), [{ add: 'consequence', to: 'pick-up-table1', says: '[teapot1] comes loose from [table1]', rules: [{ rule: 'teapot-secured-to-table', stance: 'voids' }] }], by('playByPlay'))
                expect(renderPlanForGenerator(loose).split('\n').slice(-2)).toEqual([
                    '  - consequence pick-up-table1.teapot1-comes-loose (unchecked): [teapot1] comes loose from [table1]',
                    '    - Rule (Voids) pick-up-table1.teapot-secured-to-table (unchecked): [teapot-secured-to-table]',
                ])
            })

            it('confirms consequences\' own consequence, and still leaves its rule unchecked: the rule cell is the rule\'s authority', () => {
                const [, consequence] = mergedBy(pickUp(), [cannot], by('consequences')).steps[0].items
                expect(consequence).toMatchObject({ standing: 'confirmed', rules: [{ standing: 'unchecked' }] })
            })

            it('mints a rule\'s path from its handle, unslugged, with -2 when the scope already holds it', () => {
                const plan = mergedBy(conceded(), [{ ...cannot, says: '[table1] stays put' }], by('playByPlay'))
                expect(planSteps(plan)[0].items.flatMap(itemPaths)).toEqual([
                    'pick-up-table1.intent', 'pick-up-table1.table1-cannot-be', 'pick-up-table1.table-secured-to-wall',
                    'pick-up-table1.table1-stays-put', 'pick-up-table1.table-secured-to-wall-2',
                ])
                expectWellFormed('two rules', plan)
            })

            describe('a repeat is no change (batch 44, the concession cell r1)', () => {
                const restate = { restate: 'step', to: 'pick-up-table1', says: 'pick up [table1]', intent: 'pick up [table1]', answered: 'how [table1] is held and lifted' }

                it('drops a consequence the step holds and keeps, as written: no second copy minted', () => {
                    const plan = mergedBy(conceded(), [restate, oc20, cannot], by('playByPlay'))
                    expect(plan.steps[0].items.filter(({ kind }) => kind === 'consequence')).toEqual(conceded().steps[0].items.filter(({ kind }) => kind === 'consequence'))
                    expect(plan.steps[0].alreadyAnswers).toEqual([restate.answered])
                })

                it('drops a repeat that gives a thing where the item gives none, the item kept as it is (r1 itself)', () => {
                    expect(mergedBy(conceded(), [restate, { ...cannot, thing: '[table1]' }], by('playByPlay')).steps[0].items).toEqual(conceded().steps[0].items)
                })

                it('drops a repeat within one block', () => {
                    expect(mergedBy(pickUp(), [cannot, cannot], by('playByPlay'))).toEqual(conceded())
                })

                it('drops it whoever the author: consequences\' merge too, the kept item keeping its standing', () => {
                    const plan = mergedBy(conceded(), [cannot], by('consequences'))
                    expect(plan).toEqual(conceded())
                })

                it('drops it after a revision too: the kept child is the repeat\'s, under its own path (VW-2)', () => {
                    const plan = mergedBy(conceded(), [{ ...restate, intent: '[table1] is off the floor' }, cannot], by('playByPlay'))
                    expect(planSteps(plan)[0].items.flatMap(itemPaths)).toEqual(['pick-up-table1.intent', 'pick-up-table1.table1-cannot-be', 'pick-up-table1.table-secured-to-wall'])
                })

                it.each([
                    ['another stance', { ...cannot, rules: [{ ...chain, stance: 'causes' }] }],
                    ['no rule', { add: 'consequence', to: 'pick-up-table1', says: '[table1] cannot be lifted' }],
                    ['other words', { ...cannot, says: '[table1] will not lift' }],
                ])('keeps a near copy with %s', (_, change) => {
                    expect(mergedBy(conceded(), [change], by('playByPlay')).steps[0].items.filter(({ kind }) => kind === 'consequence')).toHaveLength(2)
                })

                it('keeps a near copy on another thing than the item\'s, when both give one', () => {
                    const onTable = mergedBy(pickUp(), [{ ...cannot, thing: '[table1]' }], by('playByPlay'))
                    expect(mergedBy(onTable, [{ ...cannot, thing: '[cup1]' }], by('playByPlay')).steps[0].items.filter(({ kind }) => kind === 'consequence')).toHaveLength(2)
                })
            })

            it.each([
                ['a rule the scene doesn\'t hold', [{ ...cannot, rules: [{ rule: 'table-secured', stance: 'violation' }] }], ['change 1: rule 1: rule "table-secured" is not a rule the scene holds']],
                ['a stance other than the two', [{ ...cannot, rules: [{ ...chain, stance: 'hinders' }] }], ['change 1: rule 1: "stance" must be one of violation, causes, voids']],
                ['a rule with another key', [{ ...cannot, rules: [{ ...chain, why: 'chained' }] }], ['change 1: rule 1: has "why", not one of rule, stance']],
                ['a rule that is not an object', [{ ...cannot, rules: ['table-secured-to-wall'] }], ['change 1: rule 1: is not an object']],
                ['rules that are not a list', [{ ...cannot, rules: chain }], ['change 1: "rules" is not a list']],
                ['rules on a concern', [{ add: 'concern', to: 'pick-up-table1', says: 'it may not lift', rules: [chain] }], ['change 1: a concern takes no "rules": a rule follows from a consequence']],
                ['a rule in a branch', [{ add: 'possibility', to: 'pick-up-table1', kind: 'execution', says: 'if the chain holds', branches: [[{ says: '[table1] rises', rules: [chain] }], []] }], ['change 1: "add" must be one of steps, consequence, concern', 'change 1: branch 1, entry 1: has "rules", not one of add, thing, says']],
                ['a rule on a sub-step, outside a consequence', [{ ...oc20, steps: [oc20.steps[0], { says: 'lift [table1]', rules: [chain] }] }], ['change 1: sub-step 2: has "rules", not one of says, intent, consequences']],
                ['a sub-step consequence with no says', [{ ...oc20, steps: [oc20.steps[0], { says: 'lift [table1]', consequences: [{ thing: 'table1' }] }] }], ['change 1: sub-step 2: consequence 1: has no non-empty string "says"']],
                ['a sub-step consequence naming a thing not in the scene', [{ ...oc20, steps: [oc20.steps[0], { says: 'lift [table1]', consequences: [{ says: 'it rises', thing: 'mug1' }] }] }], ['change 1: sub-step 2: consequence 1: thing "mug1" is not in the scene']],
                ['sub-step consequences that are not a list', [{ ...oc20, steps: [oc20.steps[0], { says: 'lift [table1]', consequences: 'it rises' }] }], ['change 1: sub-step 2: "consequences" is not a list']],
                ['a standing written', [{ ...cannot, standing: 'confirmed' }], ['change 1: "standing" isn\'t writable: code sets it from who wrote the item']],
            ])('refuses %s', (_, changes, problems) => {
                expect(refusedBy(pickUp(), changes, by('playByPlay'))).toEqual(problems)
            })

            it('refuses any rule when the merge names no rules the scene holds', () => {
                expect(refusedBy(pickUp(), [cannot], { author: 'playByPlay', adds: ['consequence'] })).toEqual(['change 1: rule 1: rule "table-secured-to-wall" is not a rule the scene holds'])
            })

            describe('a revision calls its step\'s children into question (AGENT.pieceViews.planning.md, VW-2)', () => {
                const revise = { restate: 'step', to: 'pick-up-table1', says: 'pick up [table1]', intent: '[table1] is off the floor', answered: 'how [table1] is held' }
                // The step with a confirmed consequence beside the unchecked proposal and its rule.
                const held = () => mergedBy(conceded(), [{ add: 'consequence', to: 'pick-up-table1', says: '[cup1] rises' }], by('consequences'))

                it('keeps every child, each unchecked and stale, its rules with it; the intent the restatement\'s', () => {
                    expect(mergedBy(held(), [revise], by('playByPlay')).steps[0].items).toEqual([
                        { kind: 'intent', path: 'pick-up-table1.intent', standing: 'confirmed', says: '[table1] is off the floor' },
                        { kind: 'consequence', path: 'pick-up-table1.table1-cannot-be', standing: 'unchecked', stale: true, says: '[table1] cannot be lifted', rules: [
                            { kind: 'rule', path: 'pick-up-table1.table-secured-to-wall', standing: 'unchecked', stale: true, rule: 'table-secured-to-wall', stance: 'violation' },
                        ] },
                        { kind: 'consequence', path: 'pick-up-table1.cup1-rises', standing: 'unchecked', stale: true, says: '[cup1] rises' },
                    ])
                })

                it('moves them under a path minted afresh, their slugs kept, and keeps the step\'s already-answered details', () => {
                    const plan = mergedBy(held(), [{ ...revise, says: 'lift [table1]' }], by('playByPlay'))
                    expect(plan.steps[0]).toMatchObject({ path: 'lift-table1', alreadyAnswers: ['how [table1] is held'] })
                    expect(plan.steps[0].items.flatMap(itemPaths)).toEqual(['lift-table1.intent', 'lift-table1.table1-cannot-be', 'lift-table1.table-secured-to-wall', 'lift-table1.cup1-rises'])
                    expectWellFormed('moved', plan)
                })

                it('keeps a possibility and a concern too, and frees no execution possibility', () => {
                    const possible = { add: 'possibility', to: 'pick-up-table1', kind: 'execution', says: 'the grip holds', branches: [[], [{ says: '[table1] drops' }]] }
                    const withSpread = mergedBy(conceded(), [possible, { add: 'concern', to: 'pick-up-table1', says: 'the chain may hold' }], by('consequences', { adds: ['possibility', 'concern'] }))
                    const revised = mergedBy(withSpread, [{ ...revise, says: 'lift [table1]' }], by('playByPlay'))
                    expect(revised.steps[0].items.filter(({ kind }) => kind === 'possibility' || kind === 'concern')).toMatchObject([
                        { kind: 'possibility', path: 'lift-table1.execution', standing: 'unchecked', stale: true, branches: [{ path: 'lift-table1.maybe' }, { path: 'lift-table1.maybe-2', items: [{ path: 'lift-table1.table1-drops' }] }] },
                        { kind: 'concern', path: 'lift-table1.chain-may-hold', standing: 'unchecked', stale: true },
                    ])
                    expect(refusedBy(withSpread, [revise, possible], by('consequences', { adds: ['possibility'] }))).toEqual(['change 2: step pick-up-table1 already has an execution possibility; a step holds at most one'])
                })

                it('leaves the mark when the reviser gives a child again: the step is its, the consequence isn\'t (the user, 2026-11-21)', () => {
                    const plan = mergedBy(held(), [revise, cannot], by('playByPlay'))
                    expect(plan.steps[0].items.filter(({ kind }) => kind === 'consequence')).toHaveLength(2)
                    expect(plan.steps[0].items[1]).toMatchObject({ path: 'pick-up-table1.table1-cannot-be', standing: 'unchecked', stale: true })
                })

                it('settles a stale child its authority gives again: confirmed, no longer stale; its rules keep their own standing and mark', () => {
                    const revised = mergedBy(held(), [revise], by('playByPlay'))
                    const plan = mergedBy(revised, [cannot, { add: 'consequence', to: 'pick-up-table1', says: '[cup1] rises' }], by('consequences'))
                    expect(plan.steps[0].items.slice(1)).toEqual([
                        { kind: 'consequence', path: 'pick-up-table1.table1-cannot-be', standing: 'confirmed', says: '[table1] cannot be lifted', rules: [
                            { kind: 'rule', path: 'pick-up-table1.table-secured-to-wall', standing: 'unchecked', stale: true, rule: 'table-secured-to-wall', stance: 'violation' },
                        ] },
                        { kind: 'consequence', path: 'pick-up-table1.cup1-rises', standing: 'confirmed', says: '[cup1] rises' },
                    ])
                })

                it('clears it by a replace, the authority\'s new item', () => {
                    const revised = mergedBy(held(), [revise], by('playByPlay'))
                    const plan = mergedBy(revised, [{ replace: 'pick-up-table1.cup1-rises', with: { says: '[cup1] rises' } }], by('consequences', { replaces: true }))
                    expect(plan.steps[0].items[2]).toEqual({ kind: 'consequence', path: 'pick-up-table1.cup1-rises', standing: 'confirmed', says: '[cup1] rises' })
                })

                it('renders no stale mark', () => {
                    expect(renderPlanForGenerator(mergedBy(held(), [revise], by('playByPlay')))).not.toContain('stale')
                })
            })

            describe('remove: the kind\'s authority takes out an unchecked item it rejects', () => {
                const checker = (author: MergeOptions['author']) => by(author, { replaces: true })

                it('removes a consequence with its rules, and a rule from its consequence', () => {
                    expect(mergedBy(conceded(), [{ remove: 'pick-up-table1.table1-cannot-be' }], checker('consequences')).steps[0].items).toEqual(pickUp().steps[0].items)
                    expect(mergedBy(conceded(), [{ remove: 'pick-up-table1.table-secured-to-wall' }], checker('ruleCell')).steps[0].items[1]).toEqual({
                        kind: 'consequence', path: 'pick-up-table1.table1-cannot-be', standing: 'unchecked', says: '[table1] cannot be lifted',
                    })
                })

                it('removes a stale child of a step the same block revises, by its old path', () => {
                    const plan = mergedBy(conceded(), [{ restate: 'step', to: 'pick-up-table1', says: 'lift [table1]', answered: 'how' }, { remove: 'pick-up-table1.table1-cannot-be' }], checker('consequences'))
                    expect(plan.steps[0].items.flatMap(itemPaths)).toEqual(['lift-table1.intent'])
                })

                it('takes no `to` when scoped to a step, and refuses an item outside it', () => {
                    const two = mergedBy(planOf([
                        { step: { says: 'pick up [table1]', suppliedBy: 'system' }, items: [] }, { step: { says: 'set down [table1]', suppliedBy: 'system' }, items: [] },
                    ]), [{ ...cannot }], by('playByPlay'))
                    expect(mergeStepChanges(two, 'pick-up-table1', { changes: [{ remove: 'pick-up-table1.table1-cannot-be' }] }, handles, checker('consequences'))).toMatchObject({ plan: { steps: [{ items: [] }, {}] } })
                    expect(mergeStepChanges(two, 'set-down-table1', { changes: [{ remove: 'pick-up-table1.table1-cannot-be' }] }, handles, checker('consequences'))).toEqual({
                        problems: ['change 1: remove "pick-up-table1.table1-cannot-be" is not in the step being expanded, set-down-table1'],
                    })
                })

                it.each([
                    ['by default', [{ remove: 'pick-up-table1.table1-cannot-be' }], by('consequences'), ['change 1: "remove" isn\'t a change this block takes']],
                    ['by another kind\'s authority', [{ remove: 'pick-up-table1.table1-cannot-be' }], checker('ruleCell'), ['change 1: only consequences removes a consequence; this block is ruleCell\'s']],
                    ['an intent', [{ remove: 'pick-up-table1.intent' }], checker('playByPlay'), ['change 1: remove takes a consequence or a rule, not an intent']],
                    ['a step', [{ remove: 'pick-up-table1' }], checker('consequences'), ['change 1: remove "pick-up-table1" names a step; a step isn\'t removed']],
                    ['another key', [{ remove: 'pick-up-table1.table1-cannot-be', with: { says: 'x' } }], checker('consequences'), ['change 1: has "with", not one of remove']],
                    ['an item replaced in the same block', [{ remove: 'pick-up-table1.table1-cannot-be' }, { replace: 'pick-up-table1.table1-cannot-be', with: { says: 'x' } }], checker('consequences'), ['change 2: "pick-up-table1.table1-cannot-be" is already replaced or removed in this block']],
                ])('refuses a remove %s', (_, changes, options, problems) => {
                    expect(refusedBy(conceded(), changes, options)).toEqual(problems)
                })

                it('refuses a confirmed item', () => {
                    const confirmed = mergedBy(pickUp(), [{ add: 'consequence', to: 'pick-up-table1', says: '[cup1] rises' }], by('consequences'))
                    expect(refusedBy(confirmed, [{ remove: 'pick-up-table1.cup1-rises' }], checker('consequences'))).toEqual(['change 1: "pick-up-table1.cup1-rises" is confirmed; only an unchecked item is removed'])
                })
            })

            describe('replace: the kind\'s authority replaces an unchecked item with a confirmed one', () => {
                const checker = (author: MergeOptions['author']) => by(author, { replaces: true })
                const PATH = 'pick-up-table1.table1-cannot-be'

                it('confirms as written: the same text gives the same path, now confirmed, and its children leave', () => {
                    const plan = mergedBy(conceded(), [{ replace: PATH, with: { says: '[table1] cannot be lifted' } }], checker('consequences'))
                    expect(plan.steps[0].items).toEqual([
                        { kind: 'intent', path: 'pick-up-table1.intent', standing: 'confirmed', says: 'pick up [table1]' },
                        { kind: 'consequence', path: PATH, standing: 'confirmed', says: '[table1] cannot be lifted' },
                    ])
                })

                it('takes a more nuanced replacement in the old one\'s place, with a fresh path; its own rules are new, and unchecked', () => {
                    const before = mergedBy(conceded(), [{ add: 'consequence', to: 'pick-up-table1', says: '[saucer1] slides' }], by('playByPlay'))
                    const plan = mergedBy(before, [{ replace: PATH, with: { says: '[table1] rises until the chain is taut', rules: [{ rule: 'table-secured-to-wall', stance: 'causes' }] } }], checker('consequences'))
                    expect(renderPlanForGenerator(plan).split('\n').slice(2)).toEqual([
                        '  - consequence pick-up-table1.table1-rises-until: [table1] rises until the chain is taut',
                        '    - Rule (Causes) pick-up-table1.table-secured-to-wall (unchecked): [table-secured-to-wall]',
                        '  - consequence pick-up-table1.saucer1-slides (unchecked): [saucer1] slides',
                    ])
                    expectWellFormed('replaced', plan)
                })

                it('replaces a rule within its consequence, by the rule cell: the same handle keeps its path; the consequence stays as it was', () => {
                    const plan = mergedBy(conceded(), [{ replace: 'pick-up-table1.table-secured-to-wall', with: { rule: 'table-secured-to-wall', stance: 'causes' } }], checker('ruleCell'))
                    expect(plan.steps[0].items[1]).toEqual({ kind: 'consequence', path: PATH, standing: 'unchecked', says: '[table1] cannot be lifted', rules: [
                        { kind: 'rule', path: 'pick-up-table1.table-secured-to-wall', standing: 'confirmed', rule: 'table-secured-to-wall', stance: 'causes' },
                    ] })
                })

                it.each([
                    ['by a merge that takes none', [{ replace: PATH, with: { says: 'x' } }], by('consequences'), ['change 1: "replace" isn\'t a change this block takes']],
                    ['by an author not the kind\'s authority', [{ replace: PATH, with: { says: 'x' } }], checker('playByPlay'), ['change 1: only consequences replaces a consequence; this block is playByPlay\'s']],
                    ['a rule by consequences', [{ replace: 'pick-up-table1.table-secured-to-wall', with: chain }], checker('consequences'), ['change 1: only ruleCell replaces a rule; this block is consequences\'s']],
                    ['another kind (an intent)', [{ replace: 'pick-up-table1.intent', with: { says: 'x' } }], checker('playByPlay'), ['change 1: replace takes a consequence or a rule, not an intent']],
                    ['across kinds', [{ replace: PATH, with: chain }], checker('consequences'), ['change 1: with: "with" is a rule; "pick-up-table1.table1-cannot-be" is a consequence']],
                    ['a path naming no item', [{ replace: 'pick-up-table1.nothing', with: { says: 'x' } }], checker('consequences'), ['change 1: replace "pick-up-table1.nothing" names no item']],
                    ['a step', [{ replace: 'pick-up-table1', with: { says: 'x' } }], checker('consequences'), ['change 1: replace "pick-up-table1" names a step; a step isn\'t replaced']],
                    ['a with that is not an object', [{ replace: PATH, with: 'x' }], checker('consequences'), ['change 1: with: "with" is not an object']],
                    ['a with with no says', [{ replace: PATH, with: { thing: 'table1' } }], checker('consequences'), ['change 1: with: has no non-empty string "says"']],
                    ['another key', [{ replace: PATH, with: { says: 'x' }, to: 'pick-up-table1' }], checker('consequences'), ['change 1: has "to", not one of replace, with']],
                    ['one item twice', [{ replace: PATH, with: { says: 'x' } }, { replace: PATH, with: { says: 'y' } }], checker('consequences'), ['change 2: "pick-up-table1.table1-cannot-be" is already replaced or removed in this block']],
                ])('refuses a replace %s', (_, changes, options, problems) => {
                    expect(refusedBy(conceded(), changes, options)).toEqual(problems)
                })

                it('refuses a confirmed item, so nothing is replaced twice', () => {
                    const confirmed = mergedBy(conceded(), [{ replace: PATH, with: { says: '[table1] cannot be lifted' } }], checker('consequences'))
                    expect(refusedBy(confirmed, [{ replace: PATH, with: { says: 'x' } }], checker('consequences'))).toEqual(['change 1: "pick-up-table1.table1-cannot-be" is confirmed; only an unchecked item is replaced'])
                })

                it('is scoped like any change: no `to` supplied, and the path must be in the target\'s own scope', () => {
                    const expanded = mergedBy(conceded(), [{ ...oc20, steps: [oc20.steps[0], { says: 'lift [table1]', consequences: [{ says: '[table1] rises' }] }] }], by('playByPlay'))
                    const replace = { replace: PATH, with: { says: '[table1] cannot be lifted' } }
                    expect(mergeStepChanges(expanded, 'pick-up-table1', { changes: [replace] }, handles, checker('consequences'))).toEqual({ plan: mergedBy(expanded, [replace], checker('consequences')) })
                    expect(mergeStepChanges(expanded, 'lift-table1', { changes: [replace] }, handles, checker('consequences')))
                        .toEqual({ problems: ['change 1: replace "pick-up-table1.table1-cannot-be" is not in the step being expanded, lift-table1'] })
                })
            })

            it('brackets bare handles in a sub-step\'s consequences and in a replacement', () => {
                expect(bracketChanges({ changes: [{ add: 'steps', steps: [{ says: 'lift table1', consequences: [{ says: 'table1 rises' }] }] }, { replace: 'p', with: { says: 'table1 stays' } }] }, ['table1'])).toEqual({
                    changes: [{ add: 'steps', steps: [{ says: 'lift [table1]', consequences: [{ says: '[table1] rises' }] }] }, { replace: 'p', with: { says: '[table1] stays' } }],
                })
            })
        })

        it('renders the merged plan', () => {
            expect(renderPlanForGenerator(merged(h5(), [slide, spout]))).toBe([
                'Step tip-table1: tip [table1]',
                '  - intent tip-table1.intent: [teapot1] pours [tea2] into [cup1]',
                '  - consequence (intended) tip-table1.teapot1-pours-tea2: [teapot1] pours [tea2] into [cup1]',
                '  - consequence tip-table1.cup1-slides-saucer1: [cup1] slides off with [saucer1] onto the floor',
                '  - concern tip-table1.cup1-no-longer: [cup1] is no longer under [teapot1]\'s spout',
            ].join('\n'))
        })
    })
})

describe('a view of the plan (AGENT.pieceViews.planning.md, VW-1 and VW-5)', () => {
    const merged = (plan: ActionPlan, target: string, changes: unknown[], options: MergeOptions): ActionPlan => {
        const result = mergeStepChanges(plan, target, { changes }, [], options)
        if ('problems' in result) {
            throw new Error(result.problems.join('; '))
        }
        return result.plan
    }
    // One step: its confirmed intent, a confirmed consequence, possibility and concern from `consequences`; an unchecked consequence with
    // its unchecked rule from `playByPlay`; and a second step expanded by `playByPlay`, a sub-step holding an unchecked consequence.
    const base = planOf([
        { step: { says: 'pick up [table1]', suppliedBy: 'system' }, items: [{ kind: 'intent', says: 'pick up [table1]' }] },
        { step: { says: 'set down [table1]', suppliedBy: 'system' }, items: [] },
    ])
    const fromConsequences = merged(base, 'pick-up-table1', [
        { add: 'consequence', says: '[cup1] rises with [table1]' },
        { add: 'possibility', kind: 'execution', says: 'the grip holds', branches: [[], [{ says: '[table1] drops' }]] },
        { add: 'concern', says: 'the tea may spill' },
    ], { author: 'consequences' })
    const plan = merged(
        merged(fromConsequences, 'pick-up-table1', [{ add: 'consequence', says: '[table1] pulls against its chain', rules: [{ rule: 'table-secured-to-wall', stance: 'violation' }] }], { author: 'playByPlay', adds: ['consequence'], rules: ['table-secured-to-wall'] }),
        'set-down-table1',
        [{ add: 'steps', steps: [{ says: 'lower [table1]', consequences: [{ says: '[table1] touches the floor' }] }, { says: 'let go of [table1]' }] }],
        { author: 'playByPlay', adds: ['steps'] },
    )
    const lines = (view: Parameters<typeof viewPlan>[1]): string => renderPlanForGenerator(viewPlan(plan, view))

    it('gives the plan back as it is when it reads every kind at all, so its render and hash are unchanged', () => {
        expect(viewPlan(plan, WHOLE_PLAN_VIEW)).toEqual(plan)
        expect(lines(WHOLE_PLAN_VIEW)).toBe(renderPlanForGenerator(plan))
    })

    it('keeps only confirmed entries of a kind read authoritative, its own unchecked proposals included', () => {
        const text = lines({ reads: { step: 'all', intent: 'all', consequence: 'authoritative', possibility: 'authoritative' } })
        expect(text).toContain('consequence pick-up-table1.cup1-rises-table1: [cup1] rises with [table1]')
        expect(text).toContain('possibility (execution)')
        expect(text).not.toContain('pulls against its chain')
        expect(text).not.toContain('Rule (')
        expect(text).not.toContain('[table1] touches the floor')
        expect(text).toContain('step lower-table1: lower [table1]')
        expect(text).not.toContain('concern')
    })

    it('drops a consequence\'s rules when rules aren\'t read, keeping the consequence', () => {
        const text = lines({ reads: { consequence: 'all' } })
        expect(text).toContain('pulls against its chain')
        expect(text).not.toContain('Rule (')
    })

    it('always keeps the top-level steps and their already-answered details; a sub-step not read takes its items with it', () => {
        const answered = merged(plan, 'pick-up-table1', [{ restate: 'step', says: 'pick up [table1]', answered: 'how [table1] is held' }], { author: 'playByPlay', restates: true })
        const text = renderPlanForGenerator(viewPlan(answered, { reads: {} }))
        expect(text).toBe([
            'Step pick-up-table1: pick up [table1]',
            '  - already answers: how [table1] is held',
            'Step set-down-table1: set down [table1]',
        ].join('\n'))
    })
})
