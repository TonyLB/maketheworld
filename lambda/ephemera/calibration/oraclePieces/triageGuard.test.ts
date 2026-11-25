import { planSteps, type ActionPlan } from '../oracleLoop/actionPlan'
import { planFromCommand, renderTriage, triageContract, type TriageAnswer } from './triage'
import { improvisedDefers, saysHandles } from './triageGuard'

/** A reply to the command, as the contract reads it. */
const answerTo = async (fixture: string, command: string | ActionPlan, reply: object): Promise<TriageAnswer> => {
    const plan = typeof command === 'string' ? planFromCommand(command) : command
    const inputs = { fixture, plan, target: planSteps(plan)[0].path }
    const rendered = await renderTriage({ inputs, lookFor: 'anything', source: 'hand-written' })
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
})
