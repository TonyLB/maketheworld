import { buildSceneFixture, sceneFixture, teaTableProposals } from '../../dataSource/positions/ludicCache/sceneFixtures'
import { PROPOSED_OUTCOME_EXPLANATION } from '../../dataSource/actions/sceneProse/frame'
import { proposalAfter, proposedOutcomesFor } from '../sceneReasoning/proposedOutcomeBlocks'
import { oracleCases } from './oracleCases'
import { noRounds, type OracleCase } from './oracleInputs'
import { ORACLE_FRAMING, renderOracleInputs } from './renderOracleInputs'

const rendered = async (oracleCase: OracleCase, options?: Parameters<typeof renderOracleInputs>[2]): Promise<string> => {
    const outcome = await renderOracleInputs(sceneFixture(oracleCase.scene.fixture), oracleCase, options)
    if (outcome.status !== 'rendered') {
        throw new Error(`refused: ${outcome.reason}`)
    }
    return outcome.text
}

describe('renderOracleInputs', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    // Slice 2.5's composition no longer holds since a step carries its action (L-18): this pins the new layout, with the after-state still
    // the shared builder's.
    it('shows OC-6 as the drafts probe it: the action, its record line, then the after-state, provenance off', async () => {
        const fixture = sceneFixture('teaTable')
        const pour = fixture.judgeSets!.judge[4]
        const shared = (await proposedOutcomesFor(fixture, [[4, pour]], {
            form: 'both', after: 'fiction', framing: 'Candidate', explanation: PROPOSED_OUTCOME_EXPLANATION, explanationOverridden: false,
        })).get(4)
        const after = shared?.status === 'shown' ? shared.text.slice(shared.text.indexOf('After:')) : ''
        expect(after.startsWith('After:')).toBe(true)
        expect(await rendered(oracleCases['OC-6'], { show: { after: 'fiction', suppliedBy: false } })).toBe([
            "Best answer so far: I don't see how.",
            `Candidate: ${PROPOSED_OUTCOME_EXPLANATION}`,
            'Moves:\n- pour [tea2] from [teapot1] into [cup1].\n  record: [tea2] moves from [teapot1] into [cup1].',
            after,
        ].join('\n\n'))
    })

    it('by default shows a template candidate\'s action and record line with who supplied it, and no after-state', async () => {
        expect(await rendered(oracleCases['OC-6'])).toBe([
            "Best answer so far: I don't see how.",
            `Candidate: ${PROPOSED_OUTCOME_EXPLANATION}`,
            'Moves:\n- pour [tea2] from [teapot1] into [cup1] (from the system).\n  record: [tea2] moves from [teapot1] into [cup1].',
        ].join('\n\n'))
    })

    it('takes the list heading, the record label and the record verb from framing', async () => {
        const text = await rendered(oracleCases['OC-6'], { framing: { ...ORACLE_FRAMING, moves: 'Plan', record: 'in the record', recordVerb: 'goes' } })
        expect(text).toContain('Plan:\n- pour [tea2] from [teapot1] into [cup1] (from the system).\n  in the record: [tea2] goes from [teapot1] into [cup1].')
    })

    it('shows the rules a step sets out to void under its action, after any record line, with the label from framing', async () => {
        expect(await rendered(oracleCases['OC-19'], { show: { after: 'none', suppliedBy: false } })).toContain(
            'Moves:\n- pry [teapot1] off [table1] with [hammer1].\n  sets out to void: teapot-secured-to-table')
        const both: OracleCase = {
            ...oracleCases['OC-6'],
            candidates: [{ ...oracleCases['OC-6'].candidates[0], steps: [{ ...oracleCases['OC-6'].candidates[0].steps[0], voids: ['teapot-secured-to-table'] }] }],
        }
        expect(await rendered(both, { framing: { ...ORACLE_FRAMING, voids: 'aims to void' } })).toContain(
            '- pour [tea2] from [teapot1] into [cup1] (from the system).\n  record: [tea2] moves from [teapot1] into [cup1].\n  aims to void: teapot-secured-to-table')
    })

    it('builds the after-state from the record changes alone, skipping a step in words', async () => {
        const text = await rendered(oracleCases['OC-30/3'], { show: { after: 'fiction', suppliedBy: false } })
        expect(text).toContain('After:')
        expect(text).toContain('You are holding [saucer1]')
    })

    it('shows no candidate when a round has none', async () => {
        expect(await rendered(oracleCases['OC-5'])).toBe("Best answer so far: I don't see how.")
    })

    it('shows a hand-written candidate\'s steps, reuses and improvisations, with no explanation', async () => {
        expect(await rendered(oracleCases['OC-7'])).toBe([
            "Best answer so far: I don't see how.",
            'Candidate:',
            'Moves:\n- wipe [table1] with a cloth (from the player).',
            'Improvises:\n- the cloth: a cloth at hand in the parlour',
        ].join('\n\n'))
    })

    it('shows an answer-to-beat, the round record and a candidate mixing a step with a record change and a step in words only', async () => {
        expect(await rendered(oracleCases['OC-30/3'])).toBe([
            'Best answer so far:',
            "Says: The teapot is glued to the table, so you can't pour from it.",
            'Reuses: teapot-secured-to-table',
            'Known issues:\n- tipping [table1] slides [saucer1] and [cup1] off',
            'Tried already:\n- Candidate B: tipping [table1] slides [saucer1] and [cup1] off',
            'Worth another try: Candidate B',
            'Moves:\n- tip [table1] so that [teapot1] pours [tea2] into [cup1] (from the system).',
            'Reuses: teapot-secured-to-table',
            'Would do better with:\n- move [saucer1] off [table1] first',
            'Candidate:',
            'Moves:\n- pick up [saucer1] (from the system).\n  record: [saucer1] moves from [table1] to you.\n- tip [table1] so that [teapot1] pours [tea2] into [cup1] (from the system).',
            'Reuses: teapot-secured-to-table',
        ].join('\n\n'))
    })

    it('names candidates by id when there are several, shows the player\'s answers, and takes any heading from framing', async () => {
        const several: OracleCase = {
            ...oracleCases['OC-30/1'],
            answers: [{ asked: 'Which teapot?', answer: 'The glued one.' }],
            candidates: [oracleCases['OC-30/1'].candidates[0], oracleCases['OC-30/2'].candidates[0]],
        }
        const text = await rendered(several, { framing: { ...ORACLE_FRAMING, answerToBeat: 'Best so far', floor: 'Nothing yet.' } })
        expect(text.startsWith('Best so far: Nothing yet.\n\nWhat the player has answered:\n- Asked: Which teapot?\n  Answered: The glued one.')).toBe(true)
        expect(text).toContain('Candidate A:\n\nSays:')
        expect(text).toContain('Candidate B:\n\nMoves:')
    })

    it('refuses a candidate whose changes the dry run refuses, naming it', async () => {
        const glued: OracleCase = {
            ...oracleCases['OC-5'],
            candidates: [{ id: 'X', source: 'template', polarity: 'yes', steps: [{ says: 'pick up [teapot1]', change: teaTableProposals.pickUpTeapot[0], suppliedBy: 'system' }], reuses: [], improvisations: [] }],
            rounds: noRounds,
        }
        expect(await renderOracleInputs(sceneFixture('teaTable'), glued)).toEqual({ status: 'refused', candidateId: 'X', reason: 'securedToBlocksMove' })
    })
})

describe('the cases with no candidate', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    // OC-5 and OC-20 carry no candidate because the template's literal move is refused: these pin that premise.
    it.each([
        ['OC-5', 'teaTable', teaTableProposals.pickUpTeapot],
        ['OC-20', 'teaTableChained', teaTableProposals.pickUpTable],
    ] as const)('%s: the dry run refuses the template\'s move', async (_id, name, moves) => {
        const fixture = sceneFixture(name)
        const { handles } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
        expect(await proposalAfter(fixture, handles, moves)).toEqual({ status: 'refused', reason: 'securedToBlocksMove' })
    })
})
