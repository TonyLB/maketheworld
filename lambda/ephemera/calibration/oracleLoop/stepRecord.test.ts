import { planOf, planSteps, type ActionPlan, type MergeOptions, type StepItem, type StepNode } from './actionPlan'
import { mergeStepRecord, recordProblems } from './stepRecord'

const SAYS = 'pour the tea'
const TARGET = 'pour-tea'
/** A player's raw command, its intent its own text, both unchecked. */
const commandPlan = (): ActionPlan => planOf([{ step: { says: SAYS, suppliedBy: 'player' }, standing: 'unchecked', items: [{ kind: 'intent', says: SAYS, standing: 'unchecked' }] }])
const things = ['tea2', 'teapot1', 'cup1']
const RULE = 'teapot-secured-to-table'
/** A proposer, the authority for none of what it writes, and the method's authority. */
const PROPOSER: MergeOptions = { author: 'triage', adds: ['steps', 'consequence'], restates: true }
const METHOD: MergeOptions = { ...PROPOSER, author: 'playByPlay' }

const merge = (record: Record<string, unknown>, { plan = commandPlan(), answered, options = PROPOSER, rules = [] }: { plan?: ActionPlan; answered?: string; options?: MergeOptions; rules?: string[] } = {}) =>
    mergeStepRecord({ plan, target: TARGET, record, things, rules, ...(answered === undefined ? {} : { answered }) }, options)

const stepOf = (result: ReturnType<typeof merge>): StepNode => {
    if ('problems' in result) {
        throw new Error(result.problems.join('; '))
    }
    return planSteps(result.plan)[0]
}
const itemOf = <Kind extends StepItem['kind']>({ items }: StepNode, kind: Kind): Extract<StepItem, { kind: Kind }> | undefined =>
    items.find((item): item is Extract<StepItem, { kind: Kind }> => item.kind === kind)

describe('the step record', () => {
    it('restates the step with no request answered, its bare handles bracketed, as a proposal', () => {
        const step = stepOf(merge({ says: 'pour tea2 into cup1', intent: 'tea2 is in cup1' }))
        expect(step).toMatchObject({ says: 'pour [tea2] into [cup1]', standing: 'unchecked' })
        expect(itemOf(step, 'intent')).toMatchObject({ says: '[tea2] is in [cup1]', standing: 'unchecked' })
        expect(step.alreadyAnswers).toBeUndefined()
    })

    it('records the detail a request asked for, where one did', () => {
        expect(stepOf(merge({ says: SAYS }, { answered: 'how it is held', options: METHOD })).alreadyAnswers).toEqual(['how it is held'])
    })

    it('refuses a detail that says nothing', () => {
        expect(merge({ says: SAYS }, { answered: ' ', options: METHOD })).toEqual({ problems: ['"answered" is not a non-empty string'] })
    })

    it('adds a detail to the ones a step already answers, and leaves them be where a record answers none', () => {
        const first = merge({ says: SAYS }, { answered: 'how it is held', options: METHOD })
        if ('problems' in first) {
            throw new Error(first.problems.join('; '))
        }
        expect(stepOf(merge({ says: SAYS }, { plan: first.plan, options: METHOD })).alreadyAnswers).toEqual(['how it is held'])
        expect(stepOf(merge({ says: SAYS }, { plan: first.plan, answered: 'how it is tilted', options: METHOD })).alreadyAnswers).toEqual(['how it is held', 'how it is tilted'])
    })

    it('reads steps as an expansion, and consequences as the record\'s own, a rule the prompt shows among them', () => {
        const step = stepOf(merge({
            says: 'pour tea2 into cup1',
            steps: [{ says: 'lift teapot1' }, { says: 'tilt teapot1' }],
            consequences: [{ says: 'teapot1 pulls against the glue', rules: [{ rule: RULE, stance: 'violation' }] }],
        }, { rules: [RULE] }))
        expect(step.items.filter(({ kind }) => kind === 'step')).toMatchObject([{ says: 'lift [teapot1]', standing: 'unchecked' }, { says: 'tilt [teapot1]', standing: 'unchecked' }])
        expect(itemOf(step, 'consequence')).toMatchObject({ says: '[teapot1] pulls against the glue', standing: 'unchecked', rules: [{ rule: RULE, stance: 'violation', standing: 'unchecked' }] })
    })

    it('takes an empty list of steps as none', () => {
        expect(stepOf(merge({ says: SAYS, steps: [] })).items.filter(({ kind }) => kind === 'step')).toEqual([])
    })

    it('never takes a rule handle for a thing: one the prompt shows, or one the plan holds', () => {
        expect(stepOf(mergeStepRecord({ plan: commandPlan(), target: TARGET, record: { says: `pour past ${RULE}` }, things: [...things, RULE], rules: [RULE] }, PROPOSER)).says).toBe(`pour past ${RULE}`)
        const held = merge({ says: SAYS, consequences: [{ says: 'it pulls', rules: [{ rule: RULE, stance: 'violation' }] }] }, { rules: [RULE] })
        if ('problems' in held) {
            throw new Error(held.problems.join('; '))
        }
        expect(stepOf(mergeStepRecord({ plan: held.plan, target: TARGET, record: { says: `pour past ${RULE}` }, things: [...things, RULE], rules: [] }, PROPOSER)).says).toBe(`pour past ${RULE}`)
    })

    it.each<[string, Record<string, unknown>, string[]]>([
        ['a key that is no one\'s', { says: SAYS, kind: 'yes', reason: 'x' }, ['has "kind", "reason", not one of says, intent, steps, consequences']],
        ['no restatement', { steps: [] }, ['the record restates the step: it needs "says"']],
        ['consequences that aren\'t a list', { says: SAYS, consequences: {} }, ['"consequences" is not a list']],
        ['each at once', { consequences: 'x', to: TARGET }, ['has "to", not one of says, intent, steps, consequences', 'the record restates the step: it needs "says"', '"consequences" is not a list']],
    ])('refuses %s, before any merge', (_, record, problems) => {
        expect(recordProblems(record)).toEqual(problems)
        expect(merge(record)).toEqual({ problems })
    })

    it('gives a merge\'s problems in the reply\'s terms: no change numbers, a consequence by its place in the record', () => {
        const result = merge({ says: '', steps: [{ says: 'one motion' }], consequences: [{ says: 'it pours' }, 'spills'] })
        if (!('problems' in result)) {
            throw new Error('merged')
        }
        expect(result.problems.some((problem) => problem.startsWith('change '))).toBe(false)
        expect(result.problems.some((problem) => problem.startsWith('consequence 2: '))).toBe(true)
    })

    describe('things improvised, where the merge takes them', () => {
        const IMPROVISER: MergeOptions = { ...PROPOSER, adds: ['steps', 'consequence', 'improvise'] }
        const tray = { handle: '[tray1]', gloss: 'a tray to pour over' }
        const improvised = (record: Record<string, unknown>) => merge(record, { options: IMPROVISER })
        const planOfRecord = (record: Record<string, unknown>): ActionPlan => {
            const result = improvised(record)
            if ('problems' in result) {
                throw new Error(result.problems.join('; '))
            }
            return result.plan
        }

        it('join the plan, unchecked, and their bare handles are bracketed wherever the record names them', () => {
            const plan = planOfRecord({
                improvise: [{ ...tray, handle: 'tray1' }], says: 'pour tea2 over tray1', steps: [{ says: 'hold tray1' }, { says: 'tilt teapot1' }],
                consequences: [{ says: 'tray1 is wet', thing: 'tray1' }],
            })
            expect(plan.improvised).toEqual([{ handle: 'tray1', gloss: 'a tray to pour over', standing: 'unchecked' }])
            const [step] = planSteps(plan)
            expect(step.says).toBe('pour [tea2] over [tray1]')
            expect(step.items).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'step', says: 'hold [tray1]' }), expect.objectContaining({ kind: 'consequence', says: '[tray1] is wet', thing: 'tray1' })]))
        })

        it('are none when the list is empty or left out', () => {
            expect(planOfRecord({ says: SAYS, improvise: [] })).toEqual(planOfRecord({ says: SAYS }))
            expect(planOfRecord({ says: SAYS }).improvised).toBeUndefined()
        })

        it.each<[string, unknown, string[]]>([
            ['a list that isn\'t one', tray, ['"improvise" is not a list']],
            ['an entry that isn\'t an object', [tray, 'cup2'], ['improvised thing 2: is not an object']],
            ['a thing the scene has', [tray, { handle: 'cup1', gloss: 'a cup' }], ['improvised thing 2: [cup1] is in the scene already']],
            ['one given twice', [tray, tray], ['improvised thing 2: [tray1] is improvised twice']],
        ])('refuse %s, in the reply\'s terms', (_, improvise, problems) => {
            expect(improvised({ says: SAYS, improvise })).toEqual({ problems })
        })

        it('keep their numbering beside the other lists\'', () => {
            expect(improvised({ says: SAYS, steps: [{ says: 'a' }, { says: 'b' }], consequences: [{ says: ' ' }], improvise: [{ handle: 'tray1' }] })).toEqual({ problems: [
                'consequence 1: has no non-empty string "says"', 'improvised thing 1: has no non-empty string "gloss"',
            ] })
        })

        it('are a key like any other\'s where the merge doesn\'t take them, and bracket nothing', () => {
            expect(merge({ says: SAYS, improvise: [tray] })).toEqual({ problems: ['has "improvise", not one of says, intent, steps, consequences'] })
            expect(recordProblems({ says: SAYS, improvise: tray })).toEqual(['has "improvise", not one of says, intent, steps, consequences'])
        })
    })
})
