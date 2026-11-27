import { planOf, planSteps, type ActionPlan } from '../oracleLoop/actionPlan'
import { fixtureScene } from '../imaginationPieces/imaginationScene'
import type { PieceCell } from '../pieceProbe/oraclePiece'
import { handlePieceProbe, PIECE_PROBE_CALL_CAP } from '../pieceProbe/handlePieceProbe'
import { addedWords, gradeTriage, groundingOf, planFromCommand, renderTriage, triage, triageCells, triageContract, triagePlansText, type TriageAnswer, type TriageInputs } from './triage'
import { triageCorpus } from './triageCorpus'

const fenced = (value: unknown): string => `The tea has to come from somewhere.\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``

const commandCell = (fixture: string, command: string): PieceCell<TriageInputs> => {
    const plan = planFromCommand(command)
    return { inputs: { fixture, plan, target: planSteps(plan)[0].path }, source: 'hand-written' }
}

// The commands these tests reply to, apart from the cells.
const commands: Record<string, PieceCell<TriageInputs>> = {
    'pour': commandCell('teaTable', 'pour tea'),
    'wipe/cloth': commandCell('teaTable', 'wipe the table with a cloth'),
    'wipe': commandCell('teaTable', 'wipe the table'),
    'take': commandCell('tavern', 'pick up the cup'),
    'take/twoCups': commandCell('twoCups', 'pick up the cup'),
}

const parse = async (command: string, value: unknown) => (
    triageContract.parse(fenced(value), { input: commands[command].inputs, rendered: await renderTriage(commands[command]) })
)

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

const cellOf = (plan: ActionPlan, target: string): PieceCell<TriageInputs> => ({ inputs: { fixture: 'teaTable', plan, target }, source: 'hand-written' })

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
            const text = await renderTriage(commands.pour)
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

        it('takes an ambiguous reference to things in the scene, as written, its bare handles beside it bracketed', async () => {
            expect(planSteps(await value('take/twoCups', { says: 'pick up [cup1 | cup2]' }))[0].says).toBe('pick up [cup1 | cup2]')
            expect(planSteps(await value('take/twoCups', { says: 'put [cup1|cup2] on table1' }))[0].says).toBe('put [cup1|cup2] on [table1]')
        })

        it.each<[string, object, string[]]>([
            ['a side not in the scene', { says: 'pick up [cup1 | cup3]' }, ['[cup3] is not in the scene, and not improvised']],
            ['an empty side', { says: 'pick up [cup1 | ]' }, ['[cup1 | ] has an empty side']],
            ['a side named twice', { says: 'pick up [cup1 | cup1]' }, ['[cup1 | cup1] names [cup1] twice']],
            ['an improvised side', { improvise: [{ handle: 'cup3', gloss: 'a third cup' }], says: 'pick up [cup1 | cup3]' },
                ['[cup1 | cup3]: [cup3] is improvised, and an ambiguous reference holds only things in the scene']],
            ['one in a sub-step as well', { says: 'pick up [cup1 | cup2]', steps: [{ says: 'reach for [cup2 | cup2]' }, { says: 'lift it' }] }, ['[cup2 | cup2] names [cup2] twice']],
        ])('refuses an ambiguous reference with %s', async (_, record, found) => {
            expect(await problems('take/twoCups', record)).toEqual(found)
        })

        describe('the match', () => {
            it('is taken off before the merge: what it found goes beside the plan, and its improvised things into it', async () => {
                const found = await answer('wipe/cloth', { match: { inScene: ['[table1]'], improvised: [cloth] }, says: 'wipe [table1] with [cloth1]', kind: 'Yes' })
                expect(found.involved).toEqual(['[table1]', '[cloth1]'])
                expect(found.plan.improvised).toEqual([{ handle: 'cloth1', gloss: 'a cloth suitable for cleaning', standing: 'unchecked' }])
                expect(JSON.stringify(found.plan)).not.toContain('inScene')
            })

            it('takes handles with or without brackets, an ambiguous one, and an empty match', async () => {
                expect((await answer('take/twoCups', { match: { inScene: ['cup1', ' [table1] ', '[cup1 | cup2]'] }, says: 'pick up the cup', kind: 'Defer' })).involved)
                    .toEqual(['[cup1]', '[table1]', '[cup1 | cup2]'])
                expect((await answer('take/twoCups', { match: {}, says: 'pick up the cup', kind: 'Defer' })).involved).toEqual([])
            })

            it('leaves an answer with no match as it was, with nothing involved', async () => {
                expect(await answer('take', { says: 'pick up [cup1]', kind: 'Yes' })).not.toHaveProperty('involved')
            })

            it.each<[string, unknown, string[]]>([
                ['not an object', ['[cup1]'], ['"match" is not an object']],
                ['another key', { inScene: [], here: [] }, ['"match" has "here", not one of inScene, improvised']],
                ['an inScene that is no list', { inScene: '[cup1]' }, ['"inScene" is not a list']],
                ['an entry that is no string', { inScene: ['[cup1]', 3, ' '] }, ['inScene entry 2 is not a non-empty string', 'inScene entry 3 is not a non-empty string']],
                ['a handle not in the scene', { inScene: ['[cup3]'] }, ['inScene: [cup3] is not in the scene']],
                ['a side not in the scene', { inScene: ['[cup1 | cup3]'] }, ['inScene: [cup3] is not in the scene']],
                ['an improvised thing', { inScene: ['[cup3]'], improvised: [{ handle: 'cup3', gloss: 'a third cup' }] }, ['inScene: [cup3] is improvised, and "inScene" holds what the scene has']],
                ['an ambiguous entry naming a side twice', { inScene: ['[cup1 | cup1]'] }, ['inScene: [cup1 | cup1] names [cup1] twice']],
            ])('refuses %s', async (_, match, found) => {
                expect(await problems('take/twoCups', { match, says: 'pick up the cup' })).toEqual(found)
            })

            it('refuses improvised things given both in the match and beside it, and its improvised things\' own problems', async () => {
                expect(await problems('wipe/cloth', { match: { improvised: [cloth] }, improvise: [cloth], says: 'wipe [table1] with [cloth1]' })).toEqual(['"improvise" is given both in "match" and beside it'])
                expect(await problems('wipe/cloth', { match: { improvised: [{ handle: 'cloth1' }] }, says: 'wipe [table1] with [cloth1]' })).toEqual(['improvised thing 1: has no non-empty string "gloss"'])
            })
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
            expect(triageContract.parse('wipe the table', { input: commands.wipe.inputs, rendered: '' })).toEqual({ problems: ['no JSON block'] })
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

    describe('the grade', () => {
        const grade = async (command: string, reply: object) => gradeTriage(fenced(reply), commands[command], await renderTriage(commands[command]))

        it.each<[string, string, object, string, object]>([
            ['a plain "Yes"', 'take', { says: 'pick up [cup1]', kind: 'Yes' }, 'Yes', { afterGuard: 'Yes', grounding: 'cup1', matched: 'absent', added: 'none' }],
            ['a "Yes" the guard defers, its answer triage\'s own', 'pour', { says: 'pour [tea2] from [teapot1]', kind: 'Yes' }, 'Yes', { afterGuard: 'Defer', grounding: 'tea2, teapot1', matched: 'absent', added: 'none' }],
            ['a "Yes" an improvised thing defers, its handle\'s name left out', 'wipe/cloth', { improvise: [cloth], says: 'wipe [table1] with [cloth1]', kind: 'Yes' }, 'Yes', { afterGuard: 'Defer', grounding: 'table1, improvised', matched: 'absent', added: 'none' }],
            ['two improvised things', 'wipe/cloth', { improvise: [cloth, { handle: 'bowl1', gloss: 'a bowl of water' }], says: 'wipe [table1] with [cloth1] and [bowl1]', kind: 'Defer' }, 'Defer', { afterGuard: 'Defer', grounding: 'table1, improvised, improvised', matched: 'absent', added: 'none' }],
            ['handles in any order, each once, and none but the step\'s own', 'pour', { says: 'lift [teapot1] and pour [tea2] from [teapot1] into [cup1]', intent: 'no more tea in [saucer1]', steps: [{ says: 'lift [table1]' }, { says: 'tip [teapot1]' }], kind: 'Defer' }, 'Defer', { afterGuard: 'Defer', grounding: 'cup1, tea2, teapot1', matched: 'absent', added: 'lift' }],
            ['a step that names nothing', 'take/twoCups', { says: 'pick up the cup', kind: 'Defer' }, 'Defer', { afterGuard: 'Defer', grounding: 'none', matched: 'absent', added: 'none' }],
            ['a "Yes" an ambiguous reference defers, its sides sorted as one', 'take/twoCups', { says: 'pick up [cup2 | cup1]', kind: 'Yes' }, 'Yes', { afterGuard: 'Defer', grounding: 'cup1|cup2', matched: 'absent', added: 'none' }],
            ['an ambiguous reference among plain ones', 'pour', { says: 'pour [tea2 | tea1] into [cup1]', kind: 'Defer' }, 'Defer', { afterGuard: 'Defer', grounding: 'cup1, tea1|tea2', matched: 'absent', added: 'none' }],
            ['a "No"', 'wipe', { says: 'wipe [table1]', kind: 'No', reason: 'it is dry' }, 'No', { afterGuard: 'No', grounding: 'table1', matched: 'absent', added: 'none' }],
            ['a match beside a step left in words, its guard reading the match', 'pour', { match: { inScene: ['[tea2]', 'teapot1'] }, says: 'pour tea', kind: 'Yes' }, 'Yes', { afterGuard: 'Defer', grounding: 'none', matched: 'tea2, teapot1', added: 'none' }],
            ['a match with an improvised thing', 'wipe/cloth', { match: { inScene: ['[table1]'], improvised: [cloth] }, says: 'wipe [table1] with [cloth1]', kind: 'Defer' }, 'Defer', { afterGuard: 'Defer', grounding: 'table1, improvised', matched: 'table1, improvised', added: 'none' }],
        ])('keeps the answer, the branch after the guard, the grounding and the words added apart: %s', async (_, command, reply, kind, aspects) => {
            const graded = await grade(command, reply)
            expect(graded).toEqual({ answer: kind, aspects, plan: (await answer(command, reply)).plan })
        })

        it.each<[string, string, string, string]>([
            ['none, where the step is the player\'s words with their things named', 'wipe', 'wipe [table1]', 'none'],
            ['none of a thing\'s handle, nor of the words that join one', 'pour', 'pour tea from [teapot1] into [cup1] on [saucer1]', 'none'],
            ['the words of a method, each once and in order', 'pour', 'carefully tip [teapot1] and carefully pour [tea2]', 'carefully tip'],
            ['a place named in words', 'take', 'pick up the cup beside the candle', 'beside candle'],
            ['none of the player\'s words in another case', 'pour', 'Pour Tea.', 'none'],
            ['a thing\'s name in words, where the player didn\'t give it', 'pour', 'pour tea from the teapot', 'teapot'],
        ])('reads the words added to the player\'s: %s', async (_, command, says, words) => {
            expect(addedWords(await value(command, { says }), commands[command].inputs.plan.steps[0].says)).toBe(words)
            expect(await grade(command, { says, kind: 'Defer' })).toMatchObject({ aspects: { added: words } })
        })

        it('reads no word of an improvised thing\'s handle, its gloss, or the rest of the record', async () => {
            const record = { improvise: [cloth], says: 'wipe [table1] with [cloth1]', intent: 'a gleaming surface', steps: [{ says: 'fold [cloth1]' }, { says: 'rub [table1]' }], consequences: [{ says: 'dust flies' }] }
            expect(await grade('wipe', { ...record, kind: 'Defer' })).toMatchObject({ aspects: { added: 'none' } })
        })

        it('is malformed where the contract refuses the reply, with every problem', async () => {
            expect(await grade('wipe', { says: 'wipe [table1] with [cloth1]' })).toEqual({ malformed: '[cloth1] is not in the scene, and not improvised; has no string "kind"' })
        })

        it('gives a plan\'s grounding the same whatever an improvised thing is called', async () => {
            const named = (handle: string) => value('wipe/cloth', { improvise: [{ ...cloth, handle }], says: `wipe [table1] with [${handle}]` })
            expect(groundingOf(await named('rag1'))).toBe(groundingOf(await named('a-cloth')))
        })
    })

    describe('the cells', () => {
        it('are the corpus\'s rows, all in scenes they render in, each saying what to look for', async () => {
            expect(Object.keys(triageCells)).toEqual(Array.from({ length: 29 }, (_, index) => `T-${index + 1}`))
            await Promise.all(Object.entries(triageCells).map(async ([id, cell]) => {
                expect(await triage.render(cell, undefined)).toContain(`(unchecked): ${triageCorpus[id].command}\n`)
                expect(cell.lookFor).toBeTruthy()
            }))
        })

        it('are graded on the row\'s branches, and on its grounding on a "Yes" or a "Defer" alone', () => {
            expect(triageCells['T-1']).toMatchObject({ expected: 'Yes', expectedAspects: { afterGuard: ['Yes'], grounding: ['cup1'] } })
            expect(triageCells['T-13']).toMatchObject({ expected: 'Defer', expectedAspects: { afterGuard: ['Defer'], grounding: ['table1, teapot1, improvised'] } })
            expect(triageCells['T-10'].expectedAspects?.grounding).toEqual(['cup1, tea2, teapot1', 'cup1, tea1|tea2'])
            expect(triageCells['T-24'].expectedAspects?.grounding).toEqual(['cup1|cup2'])
            expect(triageCells['T-25'].expectedAspects?.grounding).toEqual(['cup1, tea2, teapot1', 'tea2, teapot1', 'tea1|tea2'])
            expect(triageCells['T-26'].expectedAspects?.grounding).toEqual(['hammer1, saucer1'])
            expect(triageCells['T-27'].expectedAspects?.grounding).toEqual(['rope1, improvised'])
            expect(triageCells['T-28'].expectedAspects?.grounding).toEqual(['coffee1, spoon1'])
            expect(triageCells['T-29'].expectedAspects?.grounding).toEqual(['coffee1, cup1, mug1'])
            expect(triageCells['T-5']).toMatchObject({ expected: 'No', expectedAspects: { afterGuard: ['No'] } })
            expect(Object.entries(triageCells).filter(([, { expectedAspects }]) => expectedAspects?.grounding === undefined).map(([id]) => id)).toEqual(['T-5', 'T-6', 'T-7', 'T-8', 'T-15', 'T-21'])
            expect(Object.entries(triageCells).filter(([, { expected, expectedAspects }]) => expected === undefined || expectedAspects === undefined).map(([id]) => id)).toEqual(['T-15', 'T-21'])
        })

        it('hold the branches as the corpus counts them', () => {
            const count = (kind: string) => Object.values(triageCells).filter(({ expected }) => expected === kind).length
            expect({ Yes: count('Yes'), No: count('No'), Defer: count('Defer') }).toEqual({ Yes: 10, No: 4, Defer: 13 })
        })

        it('grades every row right on its own grounding and branch', async () => {
            const graded = await Promise.all(Object.entries(triageCorpus).flatMap(([id, { grounded, branch }]) => grounded.map(async ({ says, improvise }) => {
                const kind = branch?.shown ?? 'Defer'
                const reply = fenced({ says, kind, ...(improvise === undefined ? {} : { improvise }), ...(kind === 'No' ? { reason: 'it is larger' } : {}) })
                const found = await gradeTriage(reply, triageCells[id], await renderTriage(triageCells[id]))
                const { expected, expectedAspects } = triageCells[id]
                return 'answer' in found && (expected ?? kind) === found.answer
                    && Object.entries(expectedAspects ?? {}).every(([name, accepted]) => accepted.includes(found.aspects?.[name] ?? ''))
                    ? [] : [`${id}: ${says}`]
            })))
            expect(graded.flat()).toEqual([])
        })
    })

    describe('the registration', () => {
        const ids = Object.keys(triageCells)
        const run = async (event: object, reply: object) => {
            const invoke = jest.fn(async () => ({ success: true as const, body: fenced(reply) }))
            const { statusCode, body } = await handlePieceProbe({ type: 'PieceProbe', piece: 'triage', instructions: 'a draft', ...event }, { invoke: invoke as never })
            return { statusCode, invoke, result: typeof body === 'string' ? JSON.parse(body) : body }
        }

        it('runs through the probe in two payloads, each within the cap, and takes no options', async () => {
            const halves = [ids.slice(0, 14), ids.slice(14)]
            const runs = await Promise.all(halves.map((cells) => run({ cells }, { says: 'wait', kind: 'Defer' })))
            expect(runs.map(({ statusCode }) => statusCode)).toEqual([200, 200])
            expect(runs.map(({ result }) => result.summary.calls)).toEqual([14, 15])
            expect(ids.length).toBeGreaterThan(PIECE_PROBE_CALL_CAP)
            expect((await run({}, { says: 'wait', kind: 'Defer' })).statusCode).toBe(400)
            expect((await run({ cells: ['T-1'], options: { scene: 'judge' } }, { says: 'wait', kind: 'Defer' })).statusCode).toBe(400)
        })

        it('is tallied on its branch, with what is kept apart from it beside it, and its plan carried to the read', async () => {
            const { result } = await run({ cells: ['T-9', 'T-15'] }, { says: 'pick up [teapot1]', kind: 'No', reason: 'it is glued' })
            expect(result.cells[0]).toMatchObject({ cell: 'T-9', expected: 'Defer', right: 0, wrong: 1, answers: { No: 1 }, aspects: { afterGuard: { right: 1, wrong: 0 }, grounding: { right: 1, wrong: 0 } } })
            expect(result.cells[1]).toMatchObject({ cell: 'T-15', right: 0, wrong: 0, aspects: { afterGuard: { right: 0, wrong: 0, given: { Defer: 1 } }, grounding: { given: { teapot1: 1 } }, added: { given: { 'pick up': 1 } } } })
            expect(result.summary).toMatchObject({ calls: 2, wrong: 1, ungraded: 1, aspects: { afterGuard: { right: 1, wrong: 0, ungraded: 1 }, grounding: { right: 1, wrong: 0, ungraded: 1 }, added: { right: 0, wrong: 0, ungraded: 2 } } })
            expect(result.read[0].grade.plan.steps[0].says).toBe('pick up [teapot1]')
        })

        it('allows a reply as long as the play-by-play\'s', async () => {
            const { invoke } = await run({ cells: ['T-1'] }, { says: 'pick up [cup1]', kind: 'Yes' })
            expect(invoke).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 1024 }))
        })

        it('prints a batch\'s calls, grouped by cell, as their verdicts, groundings and plans', async () => {
            const printed = await triagePlansText([
                { cell: 'T-14', repeat: 1, answer: fenced({ improvise: [cloth], says: 'wipe [table1] with [cloth1]', kind: 'Yes' }) },
                { cell: 'T-1', repeat: 1, answer: fenced({ says: 'pick up [cup1]', kind: 'Yes' }) },
                { cell: 'T-1', repeat: 2, answer: fenced({ says: 'gently pick up [cup1]', kind: 'Yes' }) },
                { cell: 'T-14', repeat: 2, answer: fenced({ says: 'wipe [table1]', kind: 'No', reason: 'the table is dirty' }) },
                { cell: 'T-14', repeat: 3, answer: fenced({ says: 'wipe [table1]' }) },
                { cell: 'T-14', repeat: 4, error: 'throttled' },
                { cell: 'pour', repeat: 1, answer: fenced({ says: 'pour tea', kind: 'Yes' }) },
            ])
            expect(printed.split('\n').filter((line) => line.startsWith('##'))).toEqual(['## T-14, repeat 1', '## T-14, repeat 2', '## T-14, repeat 3', '## T-14, repeat 4', '## T-1, repeat 1', '## T-1, repeat 2', '## pour, repeat 1'])
            expect(printed).toContain('T-14, repeat 1\nYes\nafter the guard: Defer\ngrounding: table1, improvised\nImprovise [cloth1] (unchecked): a cloth suitable for cleaning\nStep wipe-table1-cloth1')
            expect(printed).toContain('T-14, repeat 2\nNo: the table is dirty\ngrounding: table1\nStep wipe-table1')
            expect(printed).toContain('T-14, repeat 3\nform: has no string "kind"')
            expect(printed).toContain('T-14, repeat 4\nerror: throttled')
            expect(printed).toContain('T-1, repeat 1\nYes\ngrounding: cup1\nStep pick-up-cup1')
            expect(printed).toContain('T-1, repeat 2\nYes\ngrounding: cup1\nadded: gently\nStep ')
            expect(printed).toContain('pour, repeat 1\nnot a triage cell')
        })
    })
})
