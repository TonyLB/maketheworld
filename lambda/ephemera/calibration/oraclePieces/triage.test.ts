import { planOf, planSteps, type ActionPlan } from '../oracleLoop/actionPlan'
import { fixtureScene } from '../imaginationPieces/imaginationScene'
import type { ReadPieceCell } from '../pieceProbe/oraclePiece'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import { planFromCommand, renderTriage, triage, triageCells, triageContract, triagePlansText, type TriageAnswer, type TriageInputs } from './triage'

const fenced = (value: unknown): string => `The tea has to come from somewhere.\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``

const parse = async (cell: string, value: unknown) => {
    const { inputs } = triageCells[cell]
    return triageContract.parse(fenced(value), { input: inputs, rendered: await renderTriage(triageCells[cell]) })
}

const answer = async (cell: string, reply: unknown): Promise<TriageAnswer> => {
    const parsed = await parse(cell, reply)
    if ('problems' in parsed) {
        throw new Error(parsed.problems.join('; '))
    }
    return parsed.value
}

const refused = async (cell: string, reply: unknown): Promise<string[]> => {
    const parsed = await parse(cell, reply)
    return 'problems' in parsed ? parsed.problems : []
}

// For the tests of the record, whatever the verdict beside it: the plan a "Yes" with this record gives, or its problems.
const value = async (cell: string, record: object): Promise<ActionPlan> => (await answer(cell, { ...record, kind: 'Yes' })).plan

const problems = (cell: string, record: object): Promise<string[]> => refused(cell, { ...record, kind: 'Yes' })

const cellOf = (plan: ActionPlan, target: string): ReadPieceCell<TriageInputs> => ({ inputs: { fixture: 'teaTable', plan, target }, lookFor: 'anything', source: 'hand-written' })

const cloth = { handle: '[cloth1]', gloss: 'a cloth suitable for cleaning' }

describe('triage', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    describe('the command as a plan', () => {
        it('is one unchecked step, the player\'s, its intent its own text and unchecked', () => {
            const { steps } = planFromCommand('pour tea')
            expect(steps).toEqual([expect.objectContaining({ path: 'pour-tea', says: 'pour tea', suppliedBy: 'player', standing: 'unchecked' })])
            expect(steps[0].items).toEqual([expect.objectContaining({ kind: 'intent', says: 'pour tea', standing: 'unchecked' })])
        })
    })

    describe('the render', () => {
        it('shows the whole scene, its securing as its conditions, then the plan and nothing after it', async () => {
            const text = await renderTriage(triageCells.pour)
            const [scene, plan] = text.split('End of scene.')
            expect(Object.keys((await fixtureScene('teaTable')).things).filter((handle) => !scene.includes(`- [${handle}]`))).toEqual([])
            expect(scene).toContain('is glued to [table1] (rule [teapot-secured-to-table])')
            expect(plan.trim()).toBe('The plan:\nStep pour-tea (unchecked): pour tea\n  - intent pour-tea.intent (unchecked): pour tea')
        })

        it('throws on a target that names no step', async () => {
            await expect(renderTriage(cellOf(planFromCommand('pour tea'), 'pour-coffee'))).rejects.toThrow('names no step')
        })

        it('throws on a confirmed step, which is not triage\'s to reword', async () => {
            const confirmed = planOf([{ step: { says: 'pour tea', suppliedBy: 'player' }, items: [] }])
            await expect(renderTriage(cellOf(confirmed, 'pour-tea'))).rejects.toThrow('closed to triage')
        })
    })

    describe('the contract', () => {
        it('restates the step unchecked, and improvises nothing when the reply gives none', async () => {
            const plan = await value('pour', { says: 'pour [tea2] from [teapot1]' })
            expect(planSteps(plan)).toEqual([expect.objectContaining({ says: 'pour [tea2] from [teapot1]', standing: 'unchecked' })])
            expect(plan.improvised).toBeUndefined()
        })

        it('merges what was improvised, a proposal as all it writes is', async () => {
            const plan = await value('wipe/cloth', { improvise: [cloth], says: 'wipe [table1] with [cloth1]' })
            expect(plan.improvised).toEqual([{ handle: 'cloth1', gloss: 'a cloth suitable for cleaning', standing: 'unchecked' }])
            expect(planSteps(plan).map(({ says }) => says)).toEqual(['wipe [table1] with [cloth1]'])
        })

        it('takes a handle with or without its brackets, and brackets a bare one in the step, improvised or the scene\'s', async () => {
            const plan = await value('wipe/cloth', { improvise: [{ ...cloth, handle: 'cloth1' }], says: 'wipe table1 with cloth1' })
            expect(plan.improvised?.map(({ handle }) => handle)).toEqual(['cloth1'])
            expect(planSteps(plan)[0].says).toBe('wipe [table1] with [cloth1]')
        })

        it('takes an empty list as none, and a thing that no text names', async () => {
            expect((await value('take', { improvise: [], says: 'pick up [cup1]' })).improvised).toBeUndefined()
            expect((await value('take', { improvise: [{ handle: 'hand1', gloss: 'a hand' }], says: 'pick up [cup1]' })).improvised).toHaveLength(1)
        })

        it('refuses a handle that is neither in the scene nor improvised, wherever the record names it', async () => {
            const refused = '[cloth1] is not in the scene, and not improvised'
            expect(await problems('wipe', { says: 'wipe [table1] with [cloth1]' })).toEqual([refused])
            expect(await problems('wipe', { says: 'wipe [table1]', steps: [{ says: 'fold [cloth1]' }, { says: 'rub [table1]' }] })).toEqual([refused])
        })

        it('refuses a rule\'s handle named as a thing', async () => {
            expect(await problems('pour', { says: 'pour [tea2] past [teapot-secured-to-table]' })).toEqual(['[teapot-secured-to-table] is not in the scene, and not improvised'])
        })

        it.each<[string, unknown, string]>([
            ['a thing the scene has', [{ handle: '[cup1]', gloss: 'a cup' }], 'improvised thing 1: [cup1] is in the scene already'],
            ['the same handle twice', [cloth, { ...cloth, gloss: 'another cloth' }], 'improvised thing 2: [cloth1] is improvised twice'],
            ['something that is no handle', [{ handle: 'a clean cloth', gloss: 'a cloth' }], 'improvised thing 1: "a clean cloth" is not a handle'],
            ['an entry with no gloss', [{ handle: 'cloth1' }], 'improvised thing 1: has no non-empty string "gloss"'],
            ['a blank gloss', [{ handle: 'cloth1', gloss: ' ' }], 'improvised thing 1: has no non-empty string "gloss"'],
            ['another key', [{ ...cloth, cost: 1 }], 'improvised thing 1: has "cost", not one of add, handle, gloss'],
            ['a bare name', ['cloth1'], 'improvised thing 1: is not an object'],
            ['one thing, not in a list', cloth, '"improvise" is not a list'],
        ])('refuses %s', async (_, improvise, problem) => {
            expect(await problems('wipe', { improvise, says: 'wipe [table1]' })).toEqual([problem])
        })

        it('gives the record\'s own problems beside the improvised things\'', async () => {
            const found = await problems('wipe', { improvise: 'a cloth', say: 'wipe [table1]' })
            expect(found).toContain('"improvise" is not a list')
            expect(found.some((problem) => problem.includes('has "say", not one of improvise, says, intent, steps, consequences'))).toBe(true)
        })

        it('names a thing the plan already holds improvised, which its prompt shows, or gives it another gloss', async () => {
            const held = await value('wipe/cloth', { improvise: [cloth], says: 'wipe [table1] with [cloth1]' })
            const [{ path: target }] = planSteps(held)
            const rendered = await renderTriage(cellOf(held, target))
            expect(rendered).toContain('The plan:\nImprovise [cloth1] (unchecked): a cloth suitable for cleaning\nStep ')
            const again = (record: object) => triageContract.parse(fenced({ ...record, kind: 'Yes' }), { input: { fixture: 'teaTable', plan: held, target }, rendered })
            expect(again({ says: 'rub [table1] with [cloth1]' })).toMatchObject({ value: { plan: { improvised: held.improvised } } })
            expect(again({ improvise: [{ ...cloth, gloss: 'a rag' }], says: 'rub [table1] with [cloth1]' })).toMatchObject({ value: { plan: { improvised: [{ handle: 'cloth1', gloss: 'a rag' }] } } })
        })

        it('refuses a reply with no JSON block', () => {
            expect(triageContract.parse('wipe the table', { input: triageCells.wipe.inputs, rendered: '' })).toEqual({ problems: ['no JSON block'] })
        })
    })

    describe('the verdict', () => {
        const record = { says: 'put [table1] in [cup1]', intent: '[table1] is in [cup1]', consequences: [{ says: '[cup1] breaks' }] }

        it.each<[string, object, object]>([
            ['a "Yes"', { kind: 'Yes' }, { kind: 'Yes' }],
            ['a "Defer"', { kind: 'Defer' }, { kind: 'Defer' }],
            ['a "No", with its reason', { kind: 'No', reason: ' [table1] is larger than [cup1]. ' }, { kind: 'No', reason: '[table1] is larger than [cup1].' }],
            ['a kind in any case, spaces around it', { kind: ' no ', reason: 'it is larger' }, { kind: 'No', reason: 'it is larger' }],
            ['a reason whose handles aren\'t in the scene, or bare', { kind: 'No', reason: '[shelf1] holds table1' }, { kind: 'No', reason: '[shelf1] holds table1' }],
            ['a "Yes" with a reason, which is dropped', { kind: 'Yes', reason: 'it fits' }, { kind: 'Yes' }],
            ['a "Defer" with a reason in no form, which is dropped', { kind: 'Defer', reason: 3 }, { kind: 'Defer' }],
        ])('takes %s, and the record merged beside it', async (_, verdict, expected) => {
            const plan = await value('pour', record)
            expect(plan.steps[0].items).toContainEqual(expect.objectContaining({ kind: 'consequence', says: '[cup1] breaks', standing: 'unchecked' }))
            expect(await answer('pour', { ...record, ...verdict })).toEqual({ ...expected, plan })
            expect(await answer('pour', { ...verdict, ...record })).toEqual({ ...expected, plan })
        })

        it('takes a "Defer" that names no thing', async () => {
            expect(await answer('take/twoCups', { says: 'pick up the cup', kind: 'Defer' })).toMatchObject({ kind: 'Defer', plan: { steps: [{ says: 'pick up the cup' }] } })
        })

        it.each<[string, object, string]>([
            ['no kind', {}, 'has no string "kind"'],
            ['a kind that isn\'t a string', { kind: true }, 'has no string "kind"'],
            ['another kind', { kind: 'Maybe' }, 'kind "Maybe" is not one of No, Yes, Defer'],
            ['a "No" without a reason', { kind: 'No' }, '"No" has no non-empty string "reason"'],
            ['a "No" with a blank reason', { kind: 'No', reason: ' ' }, '"No" has no non-empty string "reason"'],
            ['a "No" whose reason isn\'t a string', { kind: 'No', reason: ['it is larger'] }, '"No" has no non-empty string "reason"'],
        ])('refuses %s', async (_, verdict, problem) => {
            expect(await refused('pour', { ...record, ...verdict })).toEqual([problem])
        })

        it.each<[string, object, string[]]>([
            ['a record without its step, whatever the verdict', { kind: 'No', reason: 'it is larger' }, ['the record restates the step: it needs "says"']],
            ['the record\'s problems and the verdict\'s together', { kind: 'No' }, ['the record restates the step: it needs "says"', '"No" has no non-empty string "reason"']],
            ['an unknown handle and the verdict\'s together', { says: 'wipe [table1] with [cloth1]' }, ['[cloth1] is not in the scene, and not improvised', 'has no string "kind"']],
        ])('refuses %s', async (_, reply, found) => {
            expect(await refused('wipe', reply)).toEqual(found)
        })
    })

    describe('the registration', () => {
        it('runs through the probe, each reply form-checked, and takes no options', async () => {
            const invoke = jest.fn(async () => ({ success: true as const, body: fenced({ improvise: [cloth], says: 'wipe [table1] with [cloth1]', kind: 'Defer' }) }))
            const event = { type: 'PieceProbe' as const, piece: 'triage', cells: ['wipe', 'wipe/cloth'], instructions: 'a draft' }
            const { statusCode, body } = await handlePieceProbe(event, { invoke: invoke as never })
            expect(statusCode).toBe(200)
            expect((typeof body === 'string' ? JSON.parse(body) : body).summary).toMatchObject({ calls: 2, formFails: 0 })
            expect((await handlePieceProbe({ ...event, options: { scene: 'judge' } }, { invoke: invoke as never })).statusCode).toBe(400)
        })

        it('has the twelve commands, one probe payload\'s cells, all in scenes it can render', async () => {
            expect(Object.keys(triageCells)).toHaveLength(12)
            await Promise.all(Object.values(triageCells).map(async (cell) => expect(await triage.render(cell, undefined)).toContain(`: ${planSteps(cell.inputs.plan)[0].says}\n`)))
        })

        it('prints a batch\'s replies as their verdicts and plans, what was improvised among them', async () => {
            const printed = await triagePlansText([{ cell: 'wipe', lookFor: '', replies: [
                { repeat: 1, reply: fenced({ improvise: [cloth], says: 'wipe [table1] with [cloth1]', kind: 'Defer' }), problems: [] },
                { repeat: 2, reply: fenced({ says: 'wipe [table1]', kind: 'No', reason: 'the table is dirty' }), problems: [] },
                { repeat: 3, reply: fenced({ says: 'wipe [table1]' }), problems: [] },
            ] }])
            expect(printed).toContain('wipe [table1] with [cloth1]')
            expect(printed).toContain('repeat 1\nDefer\nImprovise [cloth1] (unchecked): a cloth suitable for cleaning\nStep wipe-table1-cloth1')
            expect(printed).toContain('repeat 2\nNo: the table is dirty\nStep wipe-table1')
            expect(printed).toContain('repeat 3\nform: has no string "kind"')
            expect(printed.match(/Improvise/g)).toHaveLength(1)
        })
    })
})
