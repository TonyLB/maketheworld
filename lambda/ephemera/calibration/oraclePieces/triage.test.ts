import { planOf, planSteps, type ActionPlan } from '../oracleLoop/actionPlan'
import { fixtureScene } from '../imaginationPieces/imaginationScene'
import type { ReadPieceCell } from '../pieceProbe/oraclePiece'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import { planFromCommand, renderTriage, triage, triageCells, triageContract, triagePlansText, type TriageInputs, type TriageOutput } from './triage'

const fenced = (value: unknown): string => `The tea has to come from somewhere.\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``

const parse = async (cell: string, value: unknown) => {
    const { inputs } = triageCells[cell]
    return triageContract.parse(fenced(value), { input: inputs, rendered: await renderTriage(triageCells[cell]) })
}

const value = async (cell: string, reply: unknown): Promise<TriageOutput> => {
    const parsed = await parse(cell, reply)
    if ('problems' in parsed) {
        throw new Error(parsed.problems.join('; '))
    }
    return parsed.value
}

const problems = async (cell: string, reply: unknown): Promise<string[]> => {
    const parsed = await parse(cell, reply)
    return 'problems' in parsed ? parsed.problems : []
}

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
            const { plan, improvised } = await value('pour', { says: 'pour [tea2] from [teapot1]' })
            expect(planSteps(plan)).toEqual([expect.objectContaining({ says: 'pour [tea2] from [teapot1]', standing: 'unchecked' })])
            expect(improvised).toEqual([])
        })

        it('gives what was improvised beside the plan, with none of it merged', async () => {
            const { plan, improvised } = await value('wipe/cloth', { improvise: [cloth], says: 'wipe [table1] with [cloth1]' })
            expect(improvised).toEqual([{ handle: 'cloth1', gloss: 'a cloth suitable for cleaning' }])
            expect(planSteps(plan).map(({ says }) => says)).toEqual(['wipe [table1] with [cloth1]'])
            expect(JSON.stringify(plan)).not.toContain('suitable for cleaning')
        })

        it('takes a handle with or without its brackets, and brackets a bare one in the step, improvised or the scene\'s', async () => {
            const { plan, improvised } = await value('wipe/cloth', { improvise: [{ ...cloth, handle: 'cloth1' }], says: 'wipe table1 with cloth1' })
            expect(improvised.map(({ handle }) => handle)).toEqual(['cloth1'])
            expect(planSteps(plan)[0].says).toBe('wipe [table1] with [cloth1]')
        })

        it('takes an empty list as none, and a thing that no text names', async () => {
            expect((await value('take', { improvise: [], says: 'pick up [cup1]' })).improvised).toEqual([])
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
            ['the same handle twice', [cloth, { ...cloth, gloss: 'another cloth' }], '[cloth1] is improvised twice'],
            ['something that is no handle', [{ handle: 'a clean cloth', gloss: 'a cloth' }], 'improvised thing 1: "a clean cloth" is not a handle'],
            ['an entry with no gloss', [{ handle: 'cloth1' }], 'improvised thing 1: needs "handle" and "gloss", each text'],
            ['a blank gloss', [{ handle: 'cloth1', gloss: ' ' }], 'improvised thing 1: needs "handle" and "gloss", each text'],
            ['another key', [{ ...cloth, cost: 1 }], 'improvised thing 1: has "cost", not one of handle, gloss'],
            ['a bare name', ['cloth1'], 'improvised thing 1: is not an object of "handle" and "gloss"'],
            ['one thing, not in a list', cloth, '"improvise" is not a list'],
        ])('refuses %s', async (_, improvise, problem) => {
            expect(await problems('wipe', { improvise, says: 'wipe [table1]' })).toEqual([problem])
        })

        it('gives the record\'s own problems beside the improvised things\'', async () => {
            const found = await problems('wipe', { improvise: 'a cloth', say: 'wipe [table1]' })
            expect(found).toContain('"improvise" is not a list')
            expect(found.some((problem) => problem.includes('has "say", not one of says, intent, steps, consequences'))).toBe(true)
        })

        it('refuses a reply with no JSON block', () => {
            expect(triageContract.parse('wipe the table', { input: triageCells.wipe.inputs, rendered: '' })).toEqual({ problems: ['no JSON block'] })
        })
    })

    describe('the registration', () => {
        it('runs through the probe, each reply form-checked, and takes no options', async () => {
            const invoke = jest.fn(async () => ({ success: true as const, body: fenced({ improvise: [cloth], says: 'wipe [table1] with [cloth1]' }) }))
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

        it('prints a batch\'s replies as the plan, then what was improvised', async () => {
            const printed = await triagePlansText([{ cell: 'wipe', lookFor: '', replies: [
                { repeat: 1, reply: fenced({ improvise: [cloth], says: 'wipe [table1] with [cloth1]' }), problems: [] },
                { repeat: 2, reply: fenced({ says: 'wipe [table1]' }), problems: [] },
            ] }])
            expect(printed).toContain('wipe [table1] with [cloth1]')
            expect(printed).toContain('Improvised:\n- [cloth1] a cloth suitable for cleaning')
            expect(printed).toContain('Improvised: nothing')
        })
    })
})
