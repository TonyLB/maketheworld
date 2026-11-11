import { buildSceneFixture, sceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from './handlePieceProbe'
import type { PieceCell } from './oraclePiece'
import { oraclePieces } from './pieces'
import { RULE_CELL_OPTIONS, renderRuleCell, ruleCell, ruleCellCells, ruleCellWindow, type RuleCellAction, type RuleCellInputs } from './ruleCell'

const fixtureScene = async (name: string): Promise<SceneModel> => {
    const fixture = sceneFixture(name)
    return (await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene
}

const act = (says: string): RuleCellAction => ({ says, motions: { teapot1: 'stays on [table1]', table1: 'stays where it is' } })
const threeActions = [act('look at [teapot1]'), act('look at [table1]'), act('look at [cup1]')]
const cellOf = (inputs: Partial<RuleCellInputs>): PieceCell<RuleCellInputs> => ({
    inputs: { fixture: 'teaTable', rule: 'teapot-secured-to-table', actions: threeActions, ...inputs }, expected: 'allows', source: 'hand-written',
})

describe('ruleCell', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    describe('the window', () => {
        it('is every action when nothing voids the rule', () => {
            expect(ruleCellWindow(cellOf({}).inputs)).toEqual(threeActions)
        })

        it('is empty when the first action voids the rule, which code answers allows', () => {
            const cell = cellOf({ voidedAt: 1 })
            expect(ruleCellWindow(cell.inputs)).toEqual([])
            expect(ruleCell.byCode?.(cell)).toBe('allows')
        })

        it('is the actions before a later voiding one, and only those are rendered', async () => {
            const cell = cellOf({ voidedAt: 3 })
            expect(ruleCellWindow(cell.inputs)).toEqual(threeActions.slice(0, 2))
            expect(ruleCell.byCode?.(cell)).toBeUndefined()
            const text = await renderRuleCell(cell, RULE_CELL_OPTIONS)
            expect(text).toContain('Action 2: look at [table1]')
            expect(text).not.toContain('Action 3')
            expect(text).not.toContain('look at [cup1]')
        })
    })

    describe('the render', () => {
        it('shows the rule\'s things\' sub-scene without its Rules section, then the rule, its things and each action\'s motions', async () => {
            expect(await renderRuleCell(ruleCellCells['OC-1'], RULE_CELL_OPTIONS)).toBe([
                'Scene: The Parlour',
                '',
                'Fiction:',
                'In the Parlour there is [table1] Table (a small round tea table).',
                'On [table1] there is [teapot1] Teapot.',
                '[teapot1] is glued to [table1].',
                'You are holding nothing.',
                '',
                'Graph:',
                '```',
                'Contents of the Parlour:',
                '- [table1] Table (a small round tea table), in the Parlour',
                '  - [teapot1] Teapot, on [table1]; [teapot1] glued to [table1]',
                'You are holding: nothing.',
                '```',
                '',
                'End of scene.',
                '',
                'Rule:',
                '- teapot-secured-to-table: [teapot1] is glued to [table1]. This rule blocks an action that moves [teapot1] and [table1] relative to each other more than "glued to" allows, and allows an action that moves them together.',
                '',
                'The rule\'s things: [teapot1], [table1]',
                '',
                'Action 1: pick up [table1]',
                '- [teapot1]: rises with [table1], still on it',
                '- [table1]: is lifted off the floor',
            ].join('\n'))
        })

        it.each(Object.keys(ruleCellCells))('states %s\'s rule as its fact and enforcing rubric, with nothing of voiding or being in force', async (id) => {
            const text = await renderRuleCell(ruleCellCells[id], RULE_CELL_OPTIONS)
            expect(text).toMatch(/\nRule:\n- [a-z-]+: \[[^\]]+\] is [^.]+\. This rule blocks an action that moves /)
            expect(text).not.toMatch(/void|in force/)
        })

        it('leaves the scene out with show: none', async () => {
            const text = await renderRuleCell(ruleCellCells['OC-1'], { ...RULE_CELL_OPTIONS, show: 'none' })
            expect(text).not.toContain('Scene:')
            expect(text.startsWith('Rule:\n')).toBe(true)
        })

        it('adds the sub-scene\'s own Rules section with sceneRules', async () => {
            const text = await renderRuleCell(ruleCellCells['OC-1'], { ...RULE_CELL_OPTIONS, sceneRules: true })
            expect(text).toContain('\n\nRules:\n- teapot-secured-to-table: ')
        })
    })

    describe('its cells', () => {
        it.each(Object.keys(ruleCellCells))('%s renders, and every handle it names is in its fixture\'s scene', async (id) => {
            const cell = ruleCellCells[id]
            expect(ruleCell.answers).toContain(cell.expected)
            await expect(renderRuleCell(cell, RULE_CELL_OPTIONS)).resolves.toEqual(expect.any(String))
            const scene = await fixtureScene(cell.inputs.fixture)
            const named = cell.inputs.actions.flatMap(({ says, motions }) => [says, ...Object.values(motions)].flatMap((text) => [...text.matchAll(/\[([^\]]+)\]/g)].map(([, handle]) => handle)))
            expect(named.filter((handle) => scene.things[handle] === undefined)).toEqual([])
        })

        it('answers OC-19/voided by code, and no other cell', () => {
            expect(Object.entries(ruleCellCells).filter(([, cell]) => ruleCell.byCode?.(cell) !== undefined).map(([id, cell]) => [id, ruleCell.byCode?.(cell)])).toEqual([['OC-19/voided', 'allows']])
        })
    })

    describe('a cell-data error throws', () => {
        it.each([
            [{ rule: 'kettle-secured-to-table' }, /Unknown rule kettle-secured-to-table; expected one of: teapot-secured-to-table/],
            [{ actions: [{ says: 'look', motions: { teapot1: 'stays' } }] }, /Action 1's motions name teapot1; expected the rule's things: teapot1, table1/],
            [{ voidedAt: 4 }, /voidedAt 4 is not an action: expected 1 to 3/],
            [{ voidedAt: 0 }, /voidedAt 0 is not an action/],
        ])('%j', async (inputs, error) => {
            await expect(renderRuleCell(cellOf(inputs), RULE_CELL_OPTIONS)).rejects.toThrow(error)
        })
    })

    describe('its options', () => {
        it('defaults to the sub-scene, and no Rules section in the scene', () => {
            expect(ruleCell.parseOptions(undefined)).toEqual({ show: 'subScene', sceneRules: false })
            expect(ruleCell.parseOptions({ show: 'none' })).toEqual({ show: 'none', sceneRules: false })
        })

        it.each([['loud'], [{ wording: 'inForce' }], [{ show: 'all' }], [{ sceneRules: 'yes' }], [{ shout: true }]])('refuses %j', (value) => {
            expect(ruleCell.parseOptions(value)).toMatch(/^options must be \{ show\?: subScene \| none; sceneRules\?: boolean \}$/)
        })
    })

    it('is registered, and runs through the probe: eight called cells, at the cap, and one by code', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async () => ({ success: true as const, body: 'Answer: allows' }))
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'ruleCell', instructions: 'Does the rule block?', repeats: 3 }, { invoke, pieces: oraclePieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(24)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 512)).toBe(true)
        const result = JSON.parse(response.body)
        expect(result.summary).toEqual({ calls: 24, right: 12, wrong: 12, malformed: 0, errors: 0, byCode: 1 })
        expect(result.options).toEqual(RULE_CELL_OPTIONS)
    })
})
