import { tokenize } from './granuleTokens'
import { INTENT_TEMPLATES, matchIntentTemplate, type IntentTemplate } from './intentTemplates'
import { COMMAND_GRANULES } from '../enrich/objectManipulation/plan/planSkeleton'

const intentOf = (command: string) => matchIntentTemplate(tokenize(COMMAND_GRANULES, command))?.type

describe('matchIntentTemplate', () => {
    it.each([
        ['LookRoom', ['look', 'l', 'Look', 'L']],
        ['Help', ['help', 'HELP', 'help me', 'i need help', 'show help']],
        ['Home', ['home', 'go home', 'head home', 'return home', 'head back home']],
        ['PredictHypothesis', ['predict', 'PREDICT']],
        ['AwaitRoadRunner', ['wait', 'wait for the roadrunner', 'wait for road runner', 'wait for the bird']],
    ])('answers %s for each of its lexicon\'s options', (type, commands) => {
        for (const command of commands) {
            expect(intentOf(command)).toBe(type)
        }
    })

    it('tolerates surrounding and doubled whitespace', () => {
        expect(intentOf('  look  ')).toBe('LookRoom')
        expect(intentOf('wait   for the  bird')).toBe('AwaitRoadRunner')
    })

    it('reads only the whole command, never a word inside a longer one', () => {
        for (const command of ['looks', 'lookout', 'look around', 'look at door', 'helper', 'homely', 'waiting', 'wait for it', 'p', 'predicts', 'predict my plan']) {
            expect(intentOf(command)).toBeUndefined()
        }
    })

    it('has no paraphrase lexicon for look (open-ended paraphrases are no closed list\'s)', () => {
        expect(intentOf('peruse the room')).toBeUndefined()
    })

    it('reads no object command', () => {
        expect(intentOf('take cup')).toBeUndefined()
        expect(intentOf('put lamp on table')).toBeUndefined()
    })

    it('holds one row per result', () => {
        expect(INTENT_TEMPLATES.map(({ result }) => result.type)).toEqual(['LookRoom', 'Help', 'Home', 'PredictHypothesis', 'AwaitRoadRunner'])
    })

    it('admits fixed words only', () => {
        const row: IntentTemplate = {
            // @ts-expect-error: an intent row has no span
            pattern: [{ type: 'objectSpan', name: 'subject' }],
            result: { type: 'Help', confidence: 1 },
        }
        expect(row.result.type).toBe('Help')
    })
})
