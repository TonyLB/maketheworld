import { consequencesCells } from '../imaginationPieces/consequences'
import { fixtureScene } from '../imaginationPieces/imaginationScene'
import { playByPlayCells } from '../imaginationPieces/playByPlay'
import { nonRuleCellCells } from '../oraclePieces/nonRuleCell'
import { bracketChanges, bracketHandles, itemPaths, mergeChanges, mergeStepChanges, mintPaths, orderItems, planChangesContract, planOf, planFromActions, planFromCandidateSteps, planFromNonRuleSteps, planSteps, renderPlanForGenerator, slug, type ActionPlan, type MergeOptions } from './actionPlan'
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
        const intent = { kind: 'intent', path: 'tip-table1.intent', says: '[teapot1] pours [tea2] into [cup1]' }
        const intendedPour = { kind: 'consequence', path: 'tip-table1.teapot1-pours-tea2', says: '[teapot1] pours [tea2] into [cup1]', intended: true }
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
                { says: 'pick up [cup1]', suppliedBy: 'system', path: 'pick-up-cup1', items: [{ kind: 'intent', path: 'pick-up-cup1.intent', says: 'pick up [cup1]' }] },
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
        const merged = (plan: ActionPlan, changes: unknown[]): ActionPlan => {
            const result = mergeChanges(plan, { changes }, handles)
            if ('problems' in result) {
                throw new Error(result.problems.join('; '))
            }
            return result.plan
        }
        const refused = (plan: ActionPlan, block: unknown): string[] => {
            const result = mergeChanges(plan, block, handles)
            return 'problems' in result ? result.problems : []
        }

        it('h5: the worked example\'s block adds the slide after the intended pour, and the concern last', () => {
            const plan = merged(h5(), [slide, spout])
            expectWellFormed('h5', plan)
            expect(plan.steps[0].items).toEqual([
                { kind: 'intent', path: 'tip-table1.intent', says: '[teapot1] pours [tea2] into [cup1]' },
                { kind: 'consequence', path: 'tip-table1.teapot1-pours-tea2', says: '[teapot1] pours [tea2] into [cup1]', intended: true },
                { kind: 'consequence', path: 'tip-table1.cup1-slides-saucer1', says: '[cup1] slides off with [saucer1] onto the floor', thing: 'cup1' },
                { kind: 'concern', path: 'tip-table1.cup1-no-longer', says: '[cup1] is no longer under [teapot1]\'s spout' },
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
                { kind: 'consequence', path: 'tip-table1.teapot1-slides-toward', says: '[teapot1] slides toward the tipped edge', thing: 'teapot1' },
            ])
        })

        it('h10: a block that addresses a step not in the plan is refused whole', () => {
            expect(mergeChanges(h10(), { changes: [slide, { ...spout, to: 'pick-up-cup1' }] }, handles)).toEqual({ problems: ['change 2: to "pick-up-cup1" names no step'] })
        })

        it('gives a repeat of an existing item\'s text the next free -n', () => {
            const plan = merged(h5(), [{ add: 'consequence', to: 'tip-table1', says: '[teapot1] pours [tea2] into [cup1]' }])
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
            const scoped = (plan: ActionPlan, target: string, block: unknown) => mergeStepChanges(plan, target, block, handles)

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
                expect(mergeChanges(h5(), { changes: [slide], concerns: [spout] }, handles)).toEqual({ problems: ['the JSON block has "concerns"; everything it adds goes in "changes"'] })
                expect(mergeChanges(h5(), { concerns: [spout] }, handles)).toEqual({ problems: ['the JSON block has no "changes" array', 'the JSON block has "concerns"; everything it adds goes in "changes"'] })
            })

            it('names its handles in a refusal as the caller says', () => {
                expect(mergeChanges(h5(), { changes: [{ ...slide, thing: 'mug1' }] }, handles, { handlesAre: 'a listed thing' })).toEqual({ problems: ['change 1: thing "mug1" is not a listed thing'] })
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
                expect(planChangesContract.parse(reply, { input: { plan: h5(), handles }, rendered: '' })).toEqual({ value: merged(h5(), [slide, spout]) })
            })

            it('gives the form problem of a reply with no block', () => {
                expect(planChangesContract.parse('Nothing changes.', { input: { plan: h5(), handles }, rendered: '' })).toEqual({ problems: ['no JSON block'] })
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
                    { kind: 'intent', path: 'tip-table1.intent', says: '[teapot1] pours [tea2] into [cup1]' },
                    { kind: 'possibility', path: 'tip-table1.execution', openness: 'execution', says: execution.says, branches: [
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
                expect(plan.steps[0].items[1]).toEqual({ kind: 'consequence', path: 'tip-table1.tea2-spills-2', says: '[tea2] spills' })
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
                expect(mergeStepChanges(tip(), 'tip-table1', { changes: [unaddressed] }, handles)).toEqual({ plan: merged(tip(), [execution]) })
            })
        })

        describe('expansions: sub-steps and the atomic mark', () => {
            const POUR = 'pour [tea2] from [teapot1] into [cup1]'
            const pour = () => planOf([{ step: { says: POUR, suppliedBy: 'system' }, items: [{ kind: 'intent', says: POUR }] }])
            const lift = { says: 'lift [teapot1] off [table1]', intent: '[teapot1] is held above [cup1]' }
            const tilt = { says: 'tilt [teapot1] over [cup1]', intent: '[tea2] pours into [cup1]' }
            const expand = { add: 'steps', to: 'pour-tea2-teapot1', steps: [lift, tilt] }
            const mark = { mark: 'atomic', to: 'pour-tea2-teapot1' }
            const takes: MergeOptions = { adds: ['steps'], marks: ['atomic'] }
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
                expect(plan.steps).toEqual([{ says: POUR, suppliedBy: 'system', path: 'pour-tea2-teapot1', items: [
                    { kind: 'intent', path: 'pour-tea2-teapot1.intent', says: POUR },
                    { kind: 'step', path: 'lift-teapot1-table1', says: lift.says, suppliedBy: 'system', items: [{ kind: 'intent', path: 'lift-teapot1-table1.intent', says: lift.intent }] },
                    { kind: 'step', path: 'tilt-teapot1-over', says: tilt.says, suppliedBy: 'system', items: [{ kind: 'intent', path: 'tilt-teapot1-over.intent', says: tilt.intent }] },
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
                expect(plan.steps[0].items[1]).toEqual({ kind: 'step', path: 'slide-cloth1-under', says: 'slide [cloth1] under [teapot1]', suppliedBy: 'system', items: [] })
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
                const plan = expanded(expanded(pour(), [expand]), [{ add: 'consequence', to: 'lift-teapot1-table1', says: '[teapot1] rises' }], {})
                const sub = planSteps(plan).find(({ path }) => path === 'lift-teapot1-table1')
                expect(sub?.items).toEqual([
                    { kind: 'intent', path: 'lift-teapot1-table1.intent', says: lift.intent },
                    { kind: 'consequence', path: 'lift-teapot1-table1.teapot1-rises', says: '[teapot1] rises' },
                ])
            })

            it('keeps the other steps as they were, and leaves the plan it is given unchanged', () => {
                const before = planOf([{ step: { says: 'pick up [saucer1]', suppliedBy: 'system' }, items: [] }, { step: { says: POUR, suppliedBy: 'system' }, items: [] }])
                const copy = JSON.parse(JSON.stringify(before))
                const plan = expanded(before, [expand])
                expect(plan.steps[0]).toBe(before.steps[0])
                expect(before).toEqual(copy)
            })

            it('marks a step atomic, its items unchanged, and renders the tag on a step and on a sub-step', () => {
                const plan = expanded(pour(), [mark])
                expect(plan.steps[0]).toEqual({ ...pour().steps[0], atomic: true })
                expect(renderPlanForGenerator(plan).split('\n')[0]).toBe('Step pour-tea2-teapot1 (atomic): pour [tea2] from [teapot1] into [cup1]')
                const sub = expanded(expanded(pour(), [expand]), [{ mark: 'atomic', to: 'tilt-teapot1-over' }])
                expect(renderPlanForGenerator(sub).split('\n')[4]).toBe('  - step tilt-teapot1-over (atomic): tilt [teapot1] over [cup1]')
            })

            it('is scoped like any change: code supplies `to` to an expansion and to a mark', () => {
                expect(mergeStepChanges(pour(), 'pour-tea2-teapot1', { changes: [{ add: 'steps', steps: [lift, tilt] }] }, handles, takes)).toEqual({ plan: expanded(pour(), [expand]) })
                expect(mergeStepChanges(pour(), 'pour-tea2-teapot1', { changes: [{ mark: 'atomic' }] }, handles, takes)).toEqual({ plan: expanded(pour(), [mark]) })
                const once = expanded(pour(), [expand])
                expect(mergeStepChanges(once, 'tilt-teapot1-over', { changes: [{ mark: 'atomic' }] }, handles, takes)).toEqual({ plan: expanded(once, [{ mark: 'atomic', to: 'tilt-teapot1-over' }]) })
            })

            it('is refused by default, so a block takes the sub-item kinds unless told otherwise', () => {
                expect(refusedWith(pour(), [expand], {})).toEqual(['change 1: "add" must be one of consequence, concern, possibility'])
                expect(refusedWith(pour(), [mark], {})).toEqual(['change 1: "mark" isn\'t a change this block takes'])
                expect(refusedWith(pour(), [{ add: 'consequence', to: 'pour-tea2-teapot1', says: '[teapot1] tilts' }])).toEqual(['change 1: "add" must be one of steps'])
            })

            it.each([
                ['a single sub-step', [{ ...expand, steps: [lift] }], ['change 1: has 1 sub-step; an expansion needs at least two']],
                ['no steps list', [{ ...expand, steps: 'lift it' }], ['change 1: has no "steps" list']],
                ['a sub-step that is not an object', [{ ...expand, steps: [lift, 'tilt'] }], ['change 1: sub-step 2: is not an object']],
                ['a sub-step with no says', [{ ...expand, steps: [lift, { intent: 'it pours' }] }], ['change 1: sub-step 2: has no non-empty string "says"']],
                ['a sub-step with another key', [{ ...expand, steps: [lift, { ...tilt, thing: 'cup1' }] }], ['change 1: sub-step 2: has "thing", not one of says, intent']],
                ['a blank intent', [{ ...expand, steps: [lift, { ...tilt, intent: ' ' }] }], ['change 1: sub-step 2: "intent" is not a non-empty string']],
                ['an expansion with its own says', [{ ...expand, says: 'pour it' }], ['change 1: has "says", not one of add, to, steps']],
                ['a mark not taken', [{ ...mark, mark: 'done' }], ['change 1: "mark" must be one of atomic']],
                ['a mark with another key', [{ ...mark, why: 'simple' }], ['change 1: has "why", not one of mark, to']],
                ['an expansion twice in one block', [expand, expand], ['change 2: step pour-tea2-teapot1 is already expanded; expand one of its sub-steps for more detail']],
                ['a mark twice in one block', [mark, mark], ['change 2: step pour-tea2-teapot1 is already marked atomic']],
                ['an expansion, then a mark', [expand, mark], ['change 2: step pour-tea2-teapot1 is both expanded and marked atomic in this block; a step is one or the other']],
                ['a mark, then an expansion', [mark, expand], ['change 2: step pour-tea2-teapot1 is both expanded and marked atomic in this block; a step is one or the other']],
            ])('refuses %s', (_, changes, problems) => {
                expect(refusedWith(pour(), changes)).toEqual(problems)
            })

            it('refuses against what the plan already holds', () => {
                const once = expanded(pour(), [expand])
                const atomic = expanded(pour(), [mark])
                expect(refusedWith(atomic, [expand])).toEqual(['change 1: step pour-tea2-teapot1 is marked as one motion; nothing to expand'])
                expect(refusedWith(atomic, [mark])).toEqual(['change 1: step pour-tea2-teapot1 is already marked atomic'])
                expect(refusedWith(once, [expand])).toEqual(['change 1: step pour-tea2-teapot1 is already expanded; expand one of its sub-steps for more detail'])
                expect(refusedWith(once, [mark])).toEqual(['change 1: step pour-tea2-teapot1 is already expanded, so it isn\'t one motion'])
                expect(refusedWith(once, [{ ...expand, to: 'lift-teapot1-table1.intent' }])).toEqual(['change 1: to "lift-teapot1-table1.intent" names a sub-item, not a step'])
            })

            it('brackets bare handles in a sub-step\'s says and intent', () => {
                expect(bracketChanges({ changes: [{ add: 'steps', steps: [{ says: 'lift teapot1', intent: 'teapot1 is up' }, 'x'] }] }, ['teapot1'])).toEqual({
                    changes: [{ add: 'steps', steps: [{ says: 'lift [teapot1]', intent: '[teapot1] is up' }, 'x'] }],
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
