import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { renderSceneExplicit } from '../../dataSource/actions/sceneProse/renderSceneExplicit'
import { withoutSecuring } from '../../dataSource/actions/sceneProse/sceneRules'
import { fixtureScene } from '../imaginationPieces/imaginationScene'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import { pieceAnswer } from '../pieceProbe/pieceAnswer'
import { pieces } from '../pieceProbe/pieces'
import { nonRuleCellCells, renderNonRuleCell } from './nonRuleCell'
import { parseSceneReadingOptions, renderSceneReading, SCENE_READING_ANSWERS, sceneReadingCells } from './sceneReading'

const fence = (json: unknown): string => ['The scene says the table is small.', '', '```json', JSON.stringify(json), '```'].join('\n')

describe('the scene reading piece', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    const r1 = sceneReadingCells['R-1']

    it('has QS-5\'s questions and expected answers, R-2 dropped, each on its trial case\'s scene', () => {
        expect(Object.fromEntries(Object.entries(sceneReadingCells).map(([id, { inputs, expected }]) => [id, [inputs.fixture, expected]]))).toEqual({
            'R-1': ['teaTableCupOnFloor', 'no'],
            'R-3': ['teaTable', 'yes'],
            'R-4': ['teaTable', 'yes'],
            'R-5': ['teaTable', 'no'],
            'R-6': ['teaTable', 'yes'],
            'R-7': ['teaTable', 'yes'],
            'R-8': ['teaTable', 'no'],
            'R-9': ['teaTable', 'yes'],
        })
        expect(r1.inputs.fixture).toBe(nonRuleCellCells['OC-11'].inputs.fixture)
    })

    describe('the options', () => {
        it('name the scene\'s arm, with no default', () => {
            expect(parseSceneReadingOptions({ scene: 'judge' })).toEqual({ scene: 'judge' })
            expect(parseSceneReadingOptions({ scene: 'explicit' })).toEqual({ scene: 'explicit' })
            expect(typeof parseSceneReadingOptions(undefined)).toBe('string')
            expect(typeof parseSceneReadingOptions({})).toBe('string')
            expect(typeof parseSceneReadingOptions({ scene: 'D' })).toBe('string')
            expect(typeof parseSceneReadingOptions({ render: 'sections' })).toBe('string')
            expect(typeof parseSceneReadingOptions({ scene: 'explicit', securing: 'known' })).toBe('string')
        })
    })

    describe('the render', () => {
        it('`judge` is the trial\'s scene byte for byte, the securing omitted, then the question', async () => {
            const trial = await renderNonRuleCell(nonRuleCellCells['OC-30/h7'], { securing: 'omitted' })
            const scene = trial.slice(0, trial.indexOf('End of scene.') + 'End of scene.'.length)
            const cell = sceneReadingCells['R-5']
            expect(await renderSceneReading(cell, { scene: 'judge' })).toBe(`${scene}\n\nThe question: ${cell.inputs.question}`)
        })

        it('`explicit` is the explicit render of the scene after `withoutSecuring`, then the question', async () => {
            const scene = withoutSecuring(await fixtureScene('teaTableCupOnFloor'))
            const text = await renderSceneReading(r1, { scene: 'explicit' })
            expect(text).toBe(`${renderSceneExplicit(scene)}\n\nThe question: Could [table1] fit inside [cup1]?`)
            expect(text).not.toContain('glued')
        })

        it('throws on a question naming a thing not in the scene', async () => {
            await expect(renderSceneReading({ ...r1, inputs: { ...r1.inputs, question: 'Is [chair1] here?' } }, { scene: 'explicit' })).rejects.toThrow('names chair1')
        })
    })

    it('grades the block\'s answer against yes and no', () => {
        expect(pieceAnswer(fence({ answer: 'Yes' }), SCENE_READING_ANSWERS)).toEqual({ answer: 'yes' })
        expect(pieceAnswer(fence({ answer: 'no' }), SCENE_READING_ANSWERS)).toEqual({ answer: 'no' })
        expect(pieceAnswer(fence({ answer: 'maybe' }), SCENE_READING_ANSWERS)).toHaveProperty('malformed')
    })

    it('runs through the probe: every cell once, at its cap, graded', async () => {
        // A stub that says no whenever the question asks whether something stays or fits, and yes otherwise.
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => {
            const prompt = messages.map(({ content }) => (content ?? []).map((block) => ('text' in block ? block.text ?? '' : '')).join('')).join('')
            const question = prompt.slice(prompt.lastIndexOf('The question: '))
            return { success: true as const, body: fence({ answer: /stay|fit|\[teapot1\] come/.test(question) ? 'no' : 'yes' }) }
        })
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'sceneReading', instructions: 'Answer it.', options: { scene: 'explicit' }, repeats: 1 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(8)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 400)).toBe(true)
        const result = JSON.parse(response.body)
        expect(result).toMatchObject({ piece: 'sceneReading', options: { scene: 'explicit' } })
        expect(result.summary).toMatchObject({ calls: 8, right: 8, wrong: 0, malformed: 0 })
    })

    it('is refused by the probe without a render', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>()
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'sceneReading', instructions: 'Answer it.' }, { invoke, pieces })
        expect(response.statusCode).toBe(400)
        expect(invoke).not.toHaveBeenCalled()
    })
})
