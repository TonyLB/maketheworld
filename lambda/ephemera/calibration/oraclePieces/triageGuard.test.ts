import type { SceneEntry, SceneHandle, SceneModel, SceneRelation, SceneRelationTarget } from '../../dataSource/positions/ludicCache/sceneModel'
import { fixtureScene } from '../imaginationPieces/imaginationScene'
import { planSteps, type ActionPlan } from '../oracleLoop/actionPlan'
import { planFromCommand, renderTriage, triageContract, type TriageAnswer, type TriageKind } from './triage'
import { triageCorpus, type CorpusGrounding, type CorpusRow } from './triageCorpus'
import { ambiguityDefers, guarded, improvisedDefers, saysHandles, securedEnds, securingDefers } from './triageGuard'

/** A reply to the command, as the contract reads it. */
const answerTo = async (fixture: string, command: string | ActionPlan, reply: object): Promise<TriageAnswer> => {
    const plan = typeof command === 'string' ? planFromCommand(command) : command
    const inputs = { fixture, plan, target: planSteps(plan)[0].path }
    const rendered = await renderTriage({ inputs })
    const parsed = triageContract.parse(`\`\`\`json\n${JSON.stringify(reply)}\n\`\`\``, { input: inputs, rendered })
    if ('problems' in parsed) {
        throw new Error(parsed.problems.join('; '))
    }
    return parsed.value
}

const cloth = { handle: 'cloth1', gloss: 'a cloth suitable for cleaning' }
const screwdriver = { handle: 'screwdriver1', gloss: 'a screwdriver' }
const blade = { handle: 'blade1', gloss: 'something sharp' }
const hearth = { handle: 'hearth1', gloss: 'the hearth, burning' }
const hammer = { handle: 'hammer1', gloss: 'a hammer' }

describe('what code makes of triage\'s answer', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    describe('the handles the step names', () => {
        it('are its own, each once, in order, and not its intent\'s, its sub-steps\' or its consequences\'', async () => {
            const { plan } = await answerTo('teaTable', 'pour tea', {
                says: 'pour [tea2] from [teapot1], tipping [teapot1]', intent: '[tea2] is in [cup1]', kind: 'Yes',
                steps: [{ says: 'lift [teapot1] over [saucer1]' }, { says: 'tip [teapot1]' }], consequences: [{ says: '[table1] gets wet' }],
            })
            expect(saysHandles(plan)).toEqual(['tea2', 'teapot1'])
        })
    })

    describe('a "Yes" whose step names an improvised thing', () => {
        it.each<[string, string, string, object, string]>([
            ['a tool the player named', 'teaTable', 'pry the teapot off the table with a screwdriver', screwdriver, 'pry [teapot1] off [table1] with [screwdriver1]'],
            ['a cloth the player named', 'teaTable', 'wipe the table with a cloth', cloth, 'wipe [table1] with [cloth1]'],
            ['a tool named by its type', 'tavern', 'trim the wick of the candle with something sharp', blade, 'trim the wick of [candle1] with [blade1]'],
            ['a thing established with no handle', 'tavern', 'light the candle', hearth, 'light [candle1] from [hearth1]'],
            ['one written bare', 'teaTable', 'wipe the table with a cloth', cloth, 'wipe table1 with cloth1'],
        ])('is a "Defer" with the same plan: %s', async (_, fixture, command, improvised, says) => {
            const answer = await answerTo(fixture, command, { improvise: [improvised], says, kind: 'Yes' })
            expect(answer.kind).toBe('Yes')
            expect(improvisedDefers(answer)).toEqual({ kind: 'Defer', plan: answer.plan })
        })

        it('is one where its plan already held the thing, as well as where its reply improvised it', async () => {
            const { plan: held } = await answerTo('teaTable', 'wipe the table', { improvise: [cloth], says: 'wipe [table1]', kind: 'Yes' })
            const answer = await answerTo('teaTable', held, { says: 'wipe [table1] with [cloth1]', kind: 'Yes' })
            expect(improvisedDefers(answer)).toEqual({ kind: 'Defer', plan: answer.plan })
        })
    })

    describe('any other answer is as it was', () => {
        const wipe = { improvise: [cloth], says: 'wipe [table1]', kind: 'Yes' }

        it.each<[string, string, string, object]>([
            ['a "Yes" whose things are all in the scene', 'teaTable', 'pick up the cup', { says: 'pick up [cup1]', kind: 'Yes' }],
            ['a "Yes" whose improvised thing nothing names', 'teaTable', 'wipe the table', wipe],
            ['one named in the intent alone', 'teaTable', 'wipe the table', { ...wipe, intent: '[cloth1] takes up the spill' }],
            ['one named in a sub-step alone', 'teaTable', 'wipe the table', { ...wipe, steps: [{ says: 'fold [cloth1]' }, { says: 'rub [table1]' }] }],
            ['one named in a consequence alone', 'teaTable', 'wipe the table', { ...wipe, consequences: [{ says: '[cloth1] is wet' }] }],
            ['a "Yes" that names nothing', 'twoCups', 'pick up the cup', { says: 'pick up the cup', kind: 'Yes' }],
            ['a "No" that names an improvised thing', 'teaTableCupOnFloor', 'hammer the table into the cup',
                { improvise: [hammer], says: 'hammer [table1] into [cup1] with [hammer1]', kind: 'No', reason: '[table1] is larger than [cup1]' }],
            ['a "Defer" that names one', 'teaTable', 'wipe the table with a cloth', { improvise: [cloth], says: 'wipe [table1] with [cloth1]', kind: 'Defer' }],
        ])('%s', async (_, fixture, command, reply) => {
            const answer = await answerTo(fixture, command, reply)
            expect(improvisedDefers(answer)).toBe(answer)
        })
    })

    describe('a step that names two or more things the words fit equally well', () => {
        it.each<[string, string, string, object]>([
            ['two cups', 'twoCups', 'pick up the cup', { says: 'pick up [cup1 | cup2]', kind: 'Yes' }],
            ['two teas, beside a thing named plainly', 'teaTable', 'pour tea into the cup', { says: 'pour [tea1 | tea2] into [cup1]', kind: 'Yes' }],
        ])('makes a "Yes" a "Defer" with the same plan: %s', async (_, fixture, command, reply) => {
            const answer = await answerTo(fixture, command, reply)
            expect(answer.kind).toBe('Yes')
            expect(ambiguityDefers(answer)).toEqual({ kind: 'Defer', plan: answer.plan })
            expect(guarded(answer, await fixtureScene(fixture))).toEqual({ kind: 'Defer', plan: answer.plan })
        })

        it.each<[string, object]>([
            ['a "No"', { says: 'put [table1] in [cup1 | cup2]', kind: 'No', reason: 'the table is larger than either cup' }],
            ['a "Defer"', { says: 'put [table1] in [cup1 | cup2]', kind: 'Defer' }],
            ['a "Yes" that makes one in its intent alone', { says: 'pick up [table1]', intent: '[cup1 | cup2] rides along', kind: 'Yes' }],
            ['a "Yes" that makes one in a sub-step alone', { says: 'pick up [table1]', steps: [{ says: 'steady [cup1 | cup2]' }, { says: 'lift [table1]' }], kind: 'Yes' }],
        ])('leaves any other answer as it was: %s', async (_, reply) => {
            const answer = await answerTo('twoCups', 'put the table in the cup', reply)
            expect(ambiguityDefers(answer)).toBe(answer)
        })

        it('has every side read by the securing rule', async () => {
            const scene = await fixtureScene('teaTable')
            const answer = await answerTo('teaTable', 'pick up the pot', { says: 'pick up [cup1 | teapot1]', kind: 'No', reason: 'it is too hot' })
            expect(saysHandles(answer.plan)).toEqual(['cup1', 'teapot1'])
            expect(securingDefers(answer, scene)).toEqual({ kind: 'Defer', plan: answer.plan })
        })
    })

    describe('the things a securing holds', () => {
        const thing = (handle: SceneHandle) => ({ kind: 'thing' as const, handle })
        const glued = (target: SceneRelationTarget): SceneRelation => ({ kind: 'Custom', label: 'glued to', target, secured: true })
        const entry = (handle: SceneHandle, children: SceneEntry[] = []): SceneEntry => ({ kind: 'line', handle, hostingKind: 'On', first: true, elsewhere: [], joins: [], children })
        const handlesOf = (entries: readonly SceneEntry[]): SceneHandle[] => entries.flatMap(({ handle, children }) => [handle, ...handlesOf(children)])
        const sceneOf = (contents: SceneEntry[], relations: Record<SceneHandle, SceneRelation[]>, held: SceneEntry[] = []): SceneModel => ({
            room: {}, contents, concepts: [], held, exits: [],
            things: Object.fromEntries(handlesOf([...contents, ...held]).map((handle) => [handle, { kind: 'Object', relations: relations[handle] ?? [] }])),
        })
        const tray = entry('tray1', [entry('cup1')])

        it.each<[string, SceneModel, SceneHandle[]]>([
            ['none, where nothing is secured', sceneOf([tray], { cup1: [{ kind: 'Custom', label: 'leaning against', target: thing('tray1'), secured: false }, { kind: 'Associated', target: thing('tray1') }] }), []],
            ['the child alone, secured to its host', sceneOf([tray], { cup1: [glued(thing('tray1'))] }), ['cup1']],
            ['the child alone, its host the securing\'s subject', sceneOf([tray], { tray1: [glued(thing('cup1'))] }), ['cup1']],
            ['the child alone, in what the actor holds', sceneOf([], { cup1: [glued(thing('tray1'))] }, [tray]), ['cup1']],
            ['both, side by side', sceneOf([entry('table1'), entry('wall1')], { table1: [{ kind: 'SecuredTo', target: thing('wall1') }] }), ['table1', 'wall1']],
            ['both, where one is the host of the other\'s host', sceneOf([entry('table1', [tray])], { cup1: [glued(thing('table1'))] }), ['cup1', 'table1']],
            ['the subject of one to something not shown', sceneOf([entry('cup1')], { cup1: [glued({ kind: 'notShown' })] }), ['cup1']],
            ['the subject of one to something inside another, and not that other', sceneOf([entry('cup1'), entry('chest1')], { cup1: [glued({ kind: 'inside', handle: 'chest1' })] }), ['cup1']],
            ['not what carries one', sceneOf([tray, entry('wall1')], { cup1: [glued(thing('wall1'))] }), ['cup1', 'wall1']],
            ['one twice secured, once', sceneOf([tray, entry('wall1')], { cup1: [glued(thing('wall1')), glued(thing('tray1'))] }), ['cup1', 'wall1']],
        ])('are %s', (_, scene, ends) => {
            expect(securedEnds(scene)).toEqual(ends)
        })

        it('are those of a fixture\'s ties and bare securings, and of no other relation', async () => {
            expect([...securedEnds(await fixtureScene('dock'))].sort()).toEqual(['barrel1', 'boat1', 'post1'])
            expect(securedEnds(await fixtureScene('teaTable'))).toEqual(['teapot1'])
            expect([...securedEnds(await fixtureScene('teaTableChained'))].sort()).toEqual(['table1', 'teapot1', 'wall1'])
        })
    })

    describe('the corpus, as grounded', () => {
        /** The rows a securing touches. */
        const TOUCHED = ['T-9', 'T-10', 'T-11', 'T-12', 'T-13', 'T-25']
        /** Their groundings that name the tea either way and leave the glued teapot out, so no securing is touched: their "Yes" is deferred as ambiguous. */
        const UNTOUCHED = ['pour [tea1 | tea2] into [cup1]', 'pour [tea1 | tea2]']
        const groundings = Object.entries(triageCorpus).flatMap(([id, row]) => row.grounded.map((grounding): [string, string, CorpusRow, CorpusGrounding] => [id, grounding.says, row, grounding]))
        const asKind = ({ fixture, command }: CorpusRow, { says, improvise }: CorpusGrounding, kind: TriageKind): Promise<TriageAnswer> => (
            answerTo(fixture, command, { says, kind, ...(improvise === undefined ? {} : { improvise }), ...(kind === 'No' ? { reason: 'it can\'t be done' } : {}) })
        )

        it.each(groundings.flatMap(([id, says, row, grounding]) => (row.branch === undefined ? [] : [[id, says, row.branch, row, grounding] as const])))(
            '%s, "%s", has its branch after the guard', async (_id, _says, { shown, after }, row, grounding) => {
                const answer = await asKind(row, grounding, shown)
                const outcome = guarded(answer, await fixtureScene(row.fixture))
                expect(outcome).toEqual({ kind: after, plan: answer.plan, ...(answer.kind === 'No' && after === 'No' ? { reason: answer.reason } : {}) })
            },
        )

        it.each(groundings)('%s, "%s": a securing it touches defers a "Yes" and a "No", and nothing else does', async (id, says, row, grounding) => {
            const scene = await fixtureScene(row.fixture)
            const [yes, no, defer] = await Promise.all((['Yes', 'No', 'Defer'] as const).map((kind) => asKind(row, grounding, kind)))
            expect(securingDefers(defer, scene)).toBe(defer)
            if (TOUCHED.includes(id) && !UNTOUCHED.includes(says)) {
                expect(securingDefers(yes, scene)).toEqual({ kind: 'Defer', plan: yes.plan })
                expect(securingDefers(no, scene)).toEqual({ kind: 'Defer', plan: no.plan })
                expect(guarded(no, scene)).toEqual({ kind: 'Defer', plan: no.plan })
            }
            else {
                expect(securingDefers(yes, scene)).toBe(yes)
                expect(securingDefers(no, scene)).toBe(no)
            }
        })

        it('as a "Yes", an open row is deferred where its step names what it improvises, and stands where it doesn\'t', async () => {
            const row = triageCorpus['T-21']
            const scene = await fixtureScene(row.fixture)
            expect(await Promise.all(row.grounded.map(async (grounding) => guarded(await asKind(row, grounding, 'Yes'), scene).kind))).toEqual(['Defer', 'Yes'])
        })

        it('holds no handle but the step\'s own, so a glued source left out of it is missed', async () => {
            const scene = await fixtureScene('teaTable')
            const missed = await answerTo('teaTable', 'pour tea into the cup', { says: 'pour [tea2] into [cup1]', steps: [{ says: 'lift [teapot1]' }, { says: 'tip [teapot1] over [cup1]' }], kind: 'Yes' })
            expect(guarded(missed, scene)).toBe(missed)
        })
    })
})
