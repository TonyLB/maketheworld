import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import type { ReadPieceCell } from '../pieceProbe/oraclePiece'
import { pieces } from '../pieceProbe/pieces'
import { parseProblems } from '../../llm/stageContract'
import { mergeStepChanges, planOf, planSteps, renderPlanForGenerator, type ActionPlan } from '../oracleLoop/actionPlan'
import { textHash } from '../textHash'
import { fixtureScene, planHandles } from './imaginationScene'
import {
    PLAY_BY_PLAY_MERGE, PLAY_BY_PLAY_OPTIONS, checkPlayByPlay, playByPlay, playByPlayCells, playByPlayContract, playByPlayPlans, playByPlayPlansText,
    renderPlayByPlay, type PlayByPlayInputs, type PlayByPlayOptions,
} from './playByPlay'

const POUR = 'pour [tea2] from [teapot1] into [cup1]'
const pourPlan = (): ActionPlan => planOf([{ step: { says: POUR, suppliedBy: 'system' }, items: [{ kind: 'intent', says: POUR }] }])

const cellOf = (inputs: Partial<PlayByPlayInputs>): ReadPieceCell<PlayByPlayInputs> => ({
    inputs: { fixture: 'teaTable', plan: pourPlan(), target: 'pour-tea2-teapot1', missing: 'how [teapot1] is held and moved', alsoShown: ['table1'], ...inputs },
    lookFor: 'anything',
    source: 'hand-written',
})

const fenced = (value: unknown): string => `- lift [teapot1]\n- tilt it\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``
const lift = { says: 'lift [teapot1] off [table1]', intent: '[teapot1] is held above [cup1]' }
const tilt = { says: 'tilt [teapot1] over [cup1]', intent: '[tea2] pours into [cup1]' }
const expansion = { changes: [{ add: 'steps', steps: [lift, tilt] }] }
const MISSING = 'how [teapot1] is held and moved'
/** The step record as written: the target restated. */
const record = { says: POUR, intent: POUR }
/** The reply's own form: only what the model provides. */
const steps = { ...record, steps: [lift, tilt] }
const KEYS = 'not one of says, intent, steps, consequences'

describe('playByPlay', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    describe('the render', () => {
        it('gives the scene, then the plan, then the step to expand with the detail asked for, with no things line', async () => {
            const parts = (await renderPlayByPlay(cellOf({}), PLAY_BY_PLAY_OPTIONS)).split('\n\n')
            expect(parts.slice(-2)).toEqual([
                'The plan:\nStep pour-tea2-teapot1: pour [tea2] from [teapot1] into [cup1]\n  - intent pour-tea2-teapot1.intent: pour [tea2] from [teapot1] into [cup1]',
                'The step to expand: pour-tea2-teapot1\nThe detail asked for: how [teapot1] is held and moved',
            ])
            expect(parts.some((part) => part.startsWith('The things to describe'))).toBe(false)
        })

        it('shows the things the plan names in the scene, as well as the things also shown', async () => {
            const text = await renderPlayByPlay(cellOf({}), PLAY_BY_PLAY_OPTIONS)
            const scene = text.slice(0, text.indexOf('The plan:'))
            expect(['tea2', 'cup1', 'teapot1', 'table1'].filter((handle) => !scene.includes(`[${handle}]`))).toEqual([])
        })

        it('takes a sub-step as the target, and shows the expanded plan nested', async () => {
            const merged = mergeStepChanges(pourPlan(), 'pour-tea2-teapot1', expansion, [], PLAY_BY_PLAY_MERGE)
            if (!('plan' in merged)) {
                throw new Error(merged.problems.join('; '))
            }
            const text = await renderPlayByPlay(cellOf({ plan: merged.plan, target: 'tilt-teapot1-over' }), PLAY_BY_PLAY_OPTIONS)
            expect(text).toContain('  - step tilt-teapot1-over: tilt [teapot1] over [cup1]\n    - intent tilt-teapot1-over.intent: [tea2] pours into [cup1]')
            expect(text.endsWith('The step to expand: tilt-teapot1-over\nThe detail asked for: how [teapot1] is held and moved')).toBe(true)
        })

        it('shows the sub-scene\'s rules as fact and consequence under the judge render with rules: consequence', async () => {
            const text = await renderPlayByPlay(cellOf({}), { rules: 'consequence', scene: 'judge' })
            expect(text).toContain('\n\nRules:\n- teapot-secured-to-table: [teapot1] is glued to [table1]. When [table1] changes its position or orientation, [teapot1] moves with it.\n\nEnd of scene.')
            expect(text).not.toContain('blocks')
        })

        it('throws on a target already expanded: asking for one is the caller\'s error', async () => {
            const expanded = mergeStepChanges(pourPlan(), 'pour-tea2-teapot1', expansion, [], PLAY_BY_PLAY_MERGE)
            if (!('plan' in expanded)) {
                throw new Error(expanded.problems.join('; '))
            }
            await expect(renderPlayByPlay(cellOf({ plan: expanded.plan }), PLAY_BY_PLAY_OPTIONS)).rejects.toThrow(/already expanded; expand one of its sub-steps/)
        })

        it.each([
            [{ target: 'pick-up-cup1' }, /The target "pick-up-cup1" names no step of the plan/],
            [{ alsoShown: ['table1', 'wall1', 'table1'] }, /Things shown twice: table1/],
            [{ alsoShown: ['kettle1'] }, /Unknown scene handle\(s\) kettle1/],
            [{ missing: ' ' }, /No detail asked for/],
            [{ missing: 'how [kettle1] is held' }, /Unknown scene handle\(s\) kettle1/],
        ])('throws on %j', async (inputs, error) => {
            await expect(renderPlayByPlay(cellOf(inputs), PLAY_BY_PLAY_OPTIONS)).rejects.toThrow(error)
        })
    })

    describe('its options', () => {
        it('defaults to the explicit render with rule handles (IS-6), refusing rules: consequence unless the judge render is named', () => {
            expect(playByPlay.parseOptions(undefined)).toEqual({ rules: 'conditions', scene: 'explicit' })
            expect(playByPlay.parseOptions({})).toEqual({ rules: 'conditions', scene: 'explicit' })
            expect(playByPlay.parseOptions({ rules: 'none' })).toEqual({ rules: 'none', scene: 'explicit' })
            expect(playByPlay.parseOptions({ rules: 'consequence' })).toMatch(/takes no rules: 'consequence'/)
            expect(playByPlay.parseOptions({ rules: 'consequence', scene: 'judge' })).toEqual({ rules: 'consequence', scene: 'judge' })
        })

        it('takes the judge render with no rules when it names no rules, and refuses rule handles with it: they tag the explicit render', () => {
            expect(playByPlay.parseOptions({ scene: 'judge' })).toEqual({ rules: 'none', scene: 'judge' })
            expect(playByPlay.parseOptions({ rules: 'handles', scene: 'judge' })).toMatch(/rules: 'handles' tags the explicit render's securings/)
            expect(playByPlay.parseOptions({ rules: 'conditions', scene: 'judge' })).toMatch(/rules: 'conditions' tags the explicit render's securings/)
            expect(playByPlay.parseOptions({ rules: 'handles' })).toEqual({ rules: 'handles', scene: 'explicit' })
        })

        it('pins the cells\' inputs hashes on the default (OC-6/command\'s intent unchecked after batch 46, which ran it confirmed on 8fe8f0b8; the target as its path again after batch 45, which ran the target as text on a982a629, 73ad380a, 56f6e5bc, 81f6c0de, 9b9b0cce, 81abbb23, 576fcfdc; OC-6/command new with the step record; rules: conditions from step 2; batches 35 to 40 ran 5d7de0bb, b40d7083, d7e1d475, cd2cd21f, eec99d53, a401a721 on rules: handles; batch 34 ran 500b35a7, 58d72024, b8f4b846, 048eb091, df87eec6 without them)', async () => {
            const hashes = await Promise.all((['OC-1', 'OC-1b', 'OC-6', 'OC-6/command', 'OC-19', 'OC-20', 'OC-20/concession'] as const).map(async (id) => textHash(await renderPlayByPlay(playByPlayCells[id], PLAY_BY_PLAY_OPTIONS))))
            expect(hashes).toEqual(['38feccd3', 'f901398c', 'a0d0b486', '3ee72b31', 'f7943193', 'e6c6d43b', '64eca640'])
        })

        it('shows each securing with its rule\'s handle by default, and none with rules: none', async () => {
            const text = await renderPlayByPlay(playByPlayCells['OC-20'], PLAY_BY_PLAY_OPTIONS)
            expect(text).toContain('[table1] is chained to [wall1] (rule [table-secured-to-wall]). If an action moves [table1] farther from [wall1] than being chained to it allows')
            expect(await renderPlayByPlay(playByPlayCells['OC-1'], PLAY_BY_PLAY_OPTIONS)).toContain('[teapot1] is glued to [table1] (rule [teapot-secured-to-table]), so')
            expect(await renderPlayByPlay(playByPlayCells['OC-20'], { rules: 'none', scene: 'explicit' })).not.toContain('(rule [')
        })

        it.each([['loud'], [{ rules: 'v45' }], [{ sceneRules: true }], [{ show: 'none' }]])('refuses %j', (value) => {
            expect(playByPlay.parseOptions(value)).toBe("options must be { rules?: 'none' | 'consequence' | 'handles' | 'conditions', scene?: 'judge' | 'explicit' }")
        })

        it('renders the explicit scene by default, with no Fiction and Graph', async () => {
            const options = playByPlay.parseOptions({ scene: 'explicit' })
            expect(options).toEqual({ rules: 'conditions', scene: 'explicit' })
            expect(await renderPlayByPlay(playByPlayCells['OC-1'], options as PlayByPlayOptions)).not.toContain('Graph')
        })
    })

    describe('the contract', () => {
        const cell = cellOf({})
        const parse = (reply: string) => playByPlayContract.parse(reply, { input: cell.inputs, rendered: '' })
        const planOfReply = (reply: string): ActionPlan => {
            const parsed = parse(reply)
            if (!('value' in parsed)) {
                throw new Error(parsed.problems.join('; '))
            }
            return parsed.value
        }

        it('reads the record with "steps" as the restatement then the expansion, code supplying the verbs, the list, `to` and the detail answered', () => {
            const plan = planOfReply(fenced(steps))
            const changes = { changes: [{ restate: 'step', ...record, answered: MISSING }, ...expansion.changes] }
            expect({ plan }).toEqual(mergeStepChanges(pourPlan(), 'pour-tea2-teapot1', changes, [], PLAY_BY_PLAY_MERGE))
            expect(planSteps(plan).map(({ path }) => path)).toEqual(['pour-tea2-teapot1', 'lift-teapot1-table1', 'tilt-teapot1-over'])
            expect(plan.steps[0].alreadyAnswers).toEqual([MISSING])
            expect(checkPlayByPlay(fenced(steps), cell)).toEqual([])
        })

        it('reads the record with no "steps" as the step itself the answer: as written, its items kept', () => {
            const plan = planOfReply(fenced(record))
            expect(plan.steps).toEqual([{ ...pourPlan().steps[0], alreadyAnswers: [MISSING] }])
        })

        it('reads an empty "steps" as none: the step itself the answer (batch 44\'s OC-1b)', () => {
            expect(planOfReply(fenced({ ...record, steps: [] }))).toEqual(planOfReply(fenced(record)))
        })

        it('reads a changed intent as a revision, and a record with no intent as keeping the step\'s', () => {
            expect(planOfReply(fenced({ ...record, intent: '[tea2] is in [cup1]' })).steps[0].items).toEqual([
                { kind: 'intent', path: 'pour-tea2-teapot1.intent', standing: 'confirmed', says: '[tea2] is in [cup1]' },
            ])
            expect(planOfReply(fenced({ says: POUR })).steps[0].items).toEqual(pourPlan().steps[0].items)
        })

        it('reads a one-entry list as its entry, since the splitter takes the block from its first { to its last } (llm/)', () => {
            expect(planOfReply(fenced([steps]))).toEqual(planOfReply(fenced(steps)))
        })

        it('brackets bare handles in each sub-step\'s says and intent, against the handles shown', () => {
            const plan = planOfReply(fenced({ ...record, steps: [{ says: 'lift teapot1', intent: 'teapot1 is above cup1' }, tilt] }))
            expect(planSteps(plan)[1]).toMatchObject({ says: 'lift [teapot1]', items: [{ says: '[teapot1] is above [cup1]' }] })
        })

        it('keeps a handle the scene doesn\'t hold as written: a breakdown may improvise an object', () => {
            const plan = planOfReply(fenced({ ...record, steps: [{ says: 'slide [cloth1] under [teapot1]' }, tilt] }))
            expect(planSteps(plan)[1].says).toBe('slide [cloth1] under [teapot1]')
        })

        it.each([
            ['no block', 'Lift it, then tilt it.', ['no JSON block']],
            ['a list of two (the reply is one object)', fenced([steps, { atomic: true }]), ['the JSON block does not parse']],
            ['the change language written out (batch 32)', fenced({ changes: [{ add: 'steps', steps: [lift, tilt] }] }), [`has "changes", ${KEYS}`, 'the record restates the step: it needs "says"']],
            ['an empty object', fenced({}), ['the record restates the step: it needs "says"']],
            ['the old expansion, with no says', fenced({ steps: [lift, tilt] }), ['the record restates the step: it needs "says"']],
            ['the retired atomic record', fenced({ atomic: true }), ['"atomic" is retired: give the step as "says" (and "intent"); with no "steps", the step itself is the answer', 'the record restates the step: it needs "says"']],
            ['atomic beside the record', fenced({ ...record, atomic: true }), ['"atomic" is retired: give the step as "says" (and "intent"); with no "steps", the step itself is the answer']],
            ['a blank says', fenced({ ...steps, says: ' ' }), ['has no non-empty string "says"']],
            ['a blank intent', fenced({ ...steps, intent: '' }), ['"intent" is not a non-empty string']],
            ['a written `to`', fenced({ ...steps, to: 'pour-tea2-teapot1' }), [`has "to", ${KEYS}`]],
            ['a thing on the record (no per-thing lines)', fenced({ ...steps, thing: 'teapot1' }), [`has "thing", ${KEYS}`]],
            ['a replace (playByPlay is no authority for consequences or rules)', fenced({ ...steps, replace: 'pour-tea2-teapot1.intent' }), [`has "replace", ${KEYS}`]],
            ['an alreadyAnswers (code sets it)', fenced({ ...record, alreadyAnswers: [MISSING] }), [`has "alreadyAnswers", ${KEYS}`]],
            ['steps not a list', fenced({ ...record, steps: 'lift it, tilt it' }), ['has no "steps" list']],
            ['a single sub-step (a one-entry list has no reason to exist beside the record\'s says)', fenced({ ...record, steps: [lift] }), ['has 1 sub-step; an expansion needs at least two']],
            ['a sub-step with another key', fenced({ ...record, steps: [lift, { ...tilt, thing: 'cup1' }] }), ['sub-step 2: has "thing", not one of says, intent, consequences']],
        ])('refuses %s', (_, reply, problems) => {
            expect(parse(reply)).toEqual({ problems })
        })

        describe('with consequences, at two scopes (IS-5)', () => {
            const oc20 = playByPlayCells['OC-20']
            const shown = async () => ({ input: oc20.inputs, rendered: await renderPlayByPlay(oc20, PLAY_BY_PLAY_OPTIONS) })
            const chain = { rule: '[table-secured-to-wall]', stance: 'violation' }
            const pulls = { says: '[table1] pulls away from [wall1]', thing: '[table1]', rules: [chain] }
            const oc20Record = { says: 'pick up [table1]', intent: 'pick up [table1]' }
            const reply = { ...oc20Record, steps: [
                { says: 'grip [table1] by its edges', intent: '[table1] is held firmly' },
                { says: 'lift [table1] straight up', intent: '[table1] rises off the floor', consequences: [pulls] },
            ] }
            const merged = async (value: unknown): Promise<ActionPlan> => {
                const parsed = playByPlayContract.parse(fenced(value), await shown())
                if (!('value' in parsed)) {
                    throw new Error(parsed.problems.join('; '))
                }
                return parsed.value
            }
            const problems = async (value: unknown): Promise<string[]> => parseProblems(playByPlayContract.parse(fenced(value), await shown()))

            it('merges step 0\'s OC-20 reply into its worked example: the grip ordinary, the chain only in the proposals', async () => {
                expect(renderPlanForGenerator(await merged(reply))).toBe([
                    'Step pick-up-table1: pick up [table1]',
                    '  - already answers: how [table1] is held and lifted',
                    '  - intent pick-up-table1.intent: pick up [table1]',
                    '  - step grip-table1-by: grip [table1] by its edges',
                    '    - intent grip-table1-by.intent: [table1] is held firmly',
                    '  - step lift-table1-straight: lift [table1] straight up',
                    '    - intent lift-table1-straight.intent: [table1] rises off the floor',
                    '    - consequence lift-table1-straight.table1-pulls-away (unchecked): [table1] pulls away from [wall1]',
                    '      - Rule (Violation) lift-table1-straight.table-secured-to-wall (unchecked): [table-secured-to-wall]',
                ].join('\n'))
            })

            it('attaches the record\'s consequences to the target, with no steps ("you\'re asking the wrong agent")', async () => {
                const plan = await merged({ ...oc20Record, consequences: [{ says: '[table1] moves away from [wall1]', rules: [chain] }] })
                expect(renderPlanForGenerator(plan).split('\n').slice(3)).toEqual([
                    '  - consequence pick-up-table1.table1-moves-away (unchecked): [table1] moves away from [wall1]',
                    '    - Rule (Violation) pick-up-table1.table-secured-to-wall (unchecked): [table-secured-to-wall]',
                ])
            })

            it('records the same consequence at both scopes, each in its own', async () => {
                const plan = await merged({ ...reply, consequences: [pulls] })
                expect(planSteps(plan).flatMap(({ items }) => items.filter(({ kind }) => kind === 'consequence').map(({ path }) => path)))
                    .toEqual(['pick-up-table1.table1-pulls-away', 'lift-table1-straight.table1-pulls-away'])
            })

            it('brackets a bare handle in a consequence, and takes a bare rule handle', async () => {
                const plan = await merged({ ...oc20Record, consequences: [{ says: 'table1 stays', rules: [{ rule: 'table-secured-to-wall', stance: 'consistent' }] }] })
                expect(renderPlanForGenerator(plan).split('\n').slice(3)).toEqual([
                    '  - consequence pick-up-table1.table1-stays (unchecked): [table1] stays',
                    '    - Rule (Consistent) pick-up-table1.table-secured-to-wall (unchecked): [table-secured-to-wall]',
                ])
            })

            it.each([
                ['a rule outside a consequence', { ...reply, rules: [chain] }, [`has "rules", ${KEYS}`]],
                ['a rule on a sub-step', { ...oc20Record, steps: [reply.steps[0], { says: 'lift [table1]', rules: [chain] }] }, ['sub-step 2: has "rules", not one of says, intent, consequences']],
                ['a rule handle the scene doesn\'t hold', { ...oc20Record, consequences: [{ says: 'it holds', rules: [{ rule: 'table-secured', stance: 'violation' }] }] }, ['consequence 1: rule 1: rule "table-secured" is not a rule the scene holds']],
                ['a stance other than the two', { ...oc20Record, consequences: [{ says: 'it holds', rules: [{ ...chain, stance: 'blocks' }] }] }, ['consequence 1: rule 1: "stance" must be one of violation, consistent']],
                ['a consequence with no says', { ...oc20Record, consequences: [{ thing: 'table1' }] }, ['consequence 1: has no non-empty string "says"']],
                ['a rule handle as a thing', { ...oc20Record, consequences: [{ says: 'it holds', thing: 'table-secured-to-wall' }] }, ['consequence 1: thing "table-secured-to-wall" is not in the scene']],
                ['a consequence with another key', { ...oc20Record, consequences: [{ says: 'it holds', standing: 'confirmed' }] }, ['consequence 1: "standing" isn\'t writable: code sets it from who wrote the item']],
                ['consequences not a list', { ...oc20Record, consequences: { says: 'it holds' } }, ['"consequences" is not a list']],
                ['a sub-step\'s consequence with no says', { ...oc20Record, steps: [reply.steps[0], { says: 'lift [table1]', consequences: [{}] }] }, ['sub-step 2: consequence 1: has no non-empty string "says"']],
            ])('refuses %s', async (_, value, expected) => {
                expect(await problems(value)).toEqual(expected)
            })
        })
    })

    describe('its cells', () => {
        it.each(Object.keys(playByPlayCells))('%s renders, and every thing it shows or its plan names is in its fixture\'s scene', async (id) => {
            const cell = playByPlayCells[id]
            await expect(renderPlayByPlay(cell, PLAY_BY_PLAY_OPTIONS)).resolves.toEqual(expect.any(String))
            const scene = await fixtureScene(cell.inputs.fixture)
            const named = [...cell.inputs.alsoShown, ...planHandles(cell.inputs.plan)]
            expect(named.filter((handle) => scene.things[handle] === undefined)).toEqual([])
        })

        it.each([
            ['OC-1', 'pick up [table1]', 'pick-up-table1', 'confirmed'],
            ['OC-6', 'pour [tea2] from [teapot1] into [cup1]', 'pour-tea2-teapot1', 'confirmed'],
            ['OC-19', 'pry [teapot1] off [table1] with [hammer1]', 'pry-teapot1-table1', 'confirmed'],
            ['OC-20', 'pick up [table1]', 'pick-up-table1', 'confirmed'],
            ['OC-6/command', 'pour tea into cup', 'pour-tea-cup', 'unchecked'],
        ] as const)('%s is one step, %j, whose intent is its own text, and its target; the intent %s (OC-6/command\'s divined from the command)', (id, says, path, standing) => {
            const { plan, target } = playByPlayCells[id].inputs
            expect(plan).toBe(playByPlayPlans[id])
            expect(plan.steps).toEqual([{ says, suppliedBy: 'system', path, standing: 'confirmed', items: [{ kind: 'intent', path: `${path}.intent`, standing, says }] }])
            expect(target).toBe(path)
        })

        it('OC-1b is OC-1\'s plan expanded once, its target the grip sub-step, which states the detail asked for (the answered cell)', () => {
            const { plan, target, missing } = playByPlayCells['OC-1b'].inputs
            expect(planSteps(plan).map(({ path, says }) => [path, says])).toEqual([
                ['pick-up-table1', 'pick up [table1]'], ['grip-table1-by', 'grip [table1] by its edges'], ['lift-table1-floor', 'lift [table1] off the floor'],
            ])
            expect([target, missing]).toEqual(['grip-table1-by', 'how [table1] is held'])
        })

        it('the concession cell is OC-20\'s plan holding a wrong, unchecked proposal on the target, as step 0\'s example (IS-6)', async () => {
            const { plan, target, missing, fixture, alsoShown } = playByPlayCells['OC-20/concession'].inputs
            expect(renderPlanForGenerator(plan)).toBe([
                'Step pick-up-table1: pick up [table1]',
                '  - intent pick-up-table1.intent: pick up [table1]',
                '  - consequence pick-up-table1.table1-cannot-be (unchecked): [table1] cannot be lifted',
                '    - Rule (Violation) pick-up-table1.table-secured-to-wall (unchecked): [table-secured-to-wall]',
            ].join('\n'))
            const { plan: _, ...oc20 } = playByPlayCells['OC-20'].inputs
            expect({ target, missing, fixture, alsoShown }).toEqual(oc20)
        })

        describe('the concession cell\'s expansion', () => {
            const cell = playByPlayCells['OC-20/concession']
            const grip = [{ says: 'grip [table1] by its edges' }, { says: 'lift [table1] straight up' }]
            const parsed = async (value: unknown): Promise<ActionPlan> => {
                const result = playByPlayContract.parse(fenced(value), { input: cell.inputs, rendered: await renderPlayByPlay(cell, PLAY_BY_PLAY_OPTIONS) })
                if (!('value' in result)) {
                    throw new Error(result.problems.join('; '))
                }
                return result.value
            }

            it('leaves the input\'s proposal on the target, untouched, when the record keeps the step as written', async () => {
                const plan = await parsed({ says: 'pick up [table1]', intent: 'pick up [table1]', steps: grip })
                expect(plan.steps[0].items.filter(({ kind }) => kind !== 'step')).toEqual(cell.inputs.plan.steps[0].items)
            })

            it('drops it when the record revises the step, and a copy carried forward comes back unchecked', async () => {
                const revised = await parsed({ says: 'pick up [table1]', intent: '[table1] is off the floor', steps: grip })
                expect(revised.steps[0].items.filter(({ kind }) => kind !== 'step').map(({ kind }) => kind)).toEqual(['intent'])
                const carried = await parsed({ says: 'pick up [table1]', intent: '[table1] is off the floor', steps: grip, consequences: [{ says: '[table1] cannot be lifted', rules: [{ rule: 'table-secured-to-wall', stance: 'violation' }] }] })
                expect(carried.steps[0].items.find(({ kind }) => kind === 'consequence')).toMatchObject({ path: 'pick-up-table1.table1-cannot-be', standing: 'unchecked' })
            })
        })

        it('OC-6/command shows OC-6\'s scene, so the two differ by the plan alone (IS-11)', async () => {
            const scene = async (id: string) => {
                const text = await renderPlayByPlay(playByPlayCells[id], PLAY_BY_PLAY_OPTIONS)
                return text.slice(0, text.indexOf('The plan:'))
            }
            expect(await scene('OC-6/command')).toBe(await scene('OC-6'))
        })

        it('OC-6/command at the bar: a record revising the command into its handles takes a fresh path, confirmed', async () => {
            const cell = playByPlayCells['OC-6/command']
            const result = playByPlayContract.parse(fenced({ says: POUR, intent: '[tea2] is in [cup1]' }), { input: cell.inputs, rendered: await renderPlayByPlay(cell, PLAY_BY_PLAY_OPTIONS) })
            if (!('value' in result)) {
                throw new Error(result.problems.join('; '))
            }
            expect(renderPlanForGenerator(result.value)).toBe([
                'Step pour-tea2-teapot1: pour [tea2] from [teapot1] into [cup1]',
                '  - already answers: how the tea is poured',
                '  - intent pour-tea2-teapot1.intent: [tea2] is in [cup1]',
            ].join('\n'))
        })

        it('OC-6/command renders its divined intent as an offer', async () => {
            expect(await renderPlayByPlay(playByPlayCells['OC-6/command'], PLAY_BY_PLAY_OPTIONS)).toContain('The plan:\nStep pour-tea-cup: pour tea into cup\n  - intent pour-tea-cup.intent (unchecked): pour tea into cup\n')
        })

        it('OC-6/command: a record restating the command as written confirms its intent; one that leaves the intent out leaves it unchecked', async () => {
            const cell = playByPlayCells['OC-6/command']
            const read = async (record: Record<string, unknown>) => {
                const result = playByPlayContract.parse(fenced(record), { input: cell.inputs, rendered: await renderPlayByPlay(cell, PLAY_BY_PLAY_OPTIONS) })
                if (!('value' in result)) {
                    throw new Error(result.problems.join('; '))
                }
                return result.value.steps[0].items
            }
            expect(await read({ says: 'pour tea into cup', intent: 'pour tea into cup' })).toEqual([{ kind: 'intent', path: 'pour-tea-cup.intent', standing: 'confirmed', says: 'pour tea into cup' }])
            expect(await read({ says: 'pour tea into cup' })).toEqual([{ kind: 'intent', path: 'pour-tea-cup.intent', standing: 'unchecked', says: 'pour tea into cup' }])
        })

        it('OC-1 and OC-20 ask for the same detail, so they differ by the scene alone', () => {
            expect(playByPlayCells['OC-20'].inputs.missing).toBe(playByPlayCells['OC-1'].inputs.missing)
        })

        it('OC-20 shows the wall and the chain, though its plan names only the table', async () => {
            const text = await renderPlayByPlay(playByPlayCells['OC-20'], PLAY_BY_PLAY_OPTIONS)
            const scene = text.slice(0, text.indexOf('The plan:'))
            expect(scene).toContain('[wall1]')
            expect(scene).toContain('chained to')
        })
    })

    it('is registered, and runs through the probe: seven cells x 3, each reply form-checked and grouped by cell', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async () => ({
            success: true as const, body: fenced({ says: 'do it', steps: [{ says: 'take hold' }, { says: 'move it' }] }),
        }))
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'playByPlay', instructions: 'Expand the step.', repeats: 3 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(21)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 1024)).toBe(true)
        const result = JSON.parse(response.body)
        expect(result.summary).toEqual({ calls: 21, formFails: 0, errors: 0 })
        expect(result.options).toEqual(PLAY_BY_PLAY_OPTIONS)
        expect(result.read.map(({ cell, replies }: { cell: string; replies: unknown[] }) => [cell, replies.length])).toEqual(
            Object.keys(playByPlayCells).map((id) => [id, 3]),
        )
    })

    it('prints a batch\'s merged plans for reading, or why a reply gave none', async () => {
        const groups = [{ cell: 'OC-20', lookFor: '', replies: [
            { repeat: 1, reply: fenced({ says: 'pick up [table1]', steps: [{ says: 'grip [table1] by its edges' }, { says: 'lift [table1]', intent: '[table1] is off the floor' }] }), problems: [] },
            { repeat: 2, reply: fenced({ says: 'pick up [table1]', intent: 'pick up [table1]' }), problems: [] },
            { repeat: 3, reply: 'The table rises.', problems: ['no JSON block'] },
            { repeat: 4, error: 'throttled' },
        ] }, { cell: 'OC-99', lookFor: '', replies: [{ repeat: 1, reply: 'x' }] }]
        expect(await playByPlayPlansText(groups)).toBe([
            [
                '## OC-20, repeat 1',
                'Step pick-up-table1: pick up [table1]',
                '  - already answers: how [table1] is held and lifted',
                '  - intent pick-up-table1.intent: pick up [table1]',
                '  - step grip-table1-by: grip [table1] by its edges',
                '  - step lift-table1: lift [table1]',
                '    - intent lift-table1.intent: [table1] is off the floor',
            ].join('\n'),
            '## OC-20, repeat 2\nStep pick-up-table1: pick up [table1]\n  - already answers: how [table1] is held and lifted\n  - intent pick-up-table1.intent: pick up [table1]',
            '## OC-20, repeat 3\nform: no JSON block',
            '## OC-20, repeat 4\nerror: throttled',
            '## OC-99, repeat 1\nnot a playByPlay cell',
        ].join('\n\n'))
    })

    it('reads a reply naming a rule, since each cell is rendered with the batch\'s options and so shows its rule handles', async () => {
        const reply = fenced({ says: 'pick up [table1]', consequences: [{ says: '[table1] moves away from [wall1]', rules: [{ rule: 'table-secured-to-wall', stance: 'violation' }] }] })
        const groups = [{ cell: 'OC-20', lookFor: '', replies: [{ repeat: 1, reply, problems: [] }] }]
        expect((await playByPlayPlansText(groups, PLAY_BY_PLAY_OPTIONS)).split('\n').slice(-1)).toEqual(['    - Rule (Violation) pick-up-table1.table-secured-to-wall (unchecked): [table-secured-to-wall]'])
        expect(await playByPlayPlansText(groups, { rules: 'none' })).toContain('form: consequence 1: rule 1: rule "table-secured-to-wall" is not a rule the scene holds')
    })
})
