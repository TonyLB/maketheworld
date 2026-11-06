import { buildSceneFixture, sceneFixture } from '../../positions/ludicCache/sceneFixtures'
import { characterId, objectId, roomId } from '../../positions/ludicCache/sceneFixtures/worldBuilders'
import { EphemeraLudicGraph } from '../../positions/ludicGraph'
import { dryRunProposedMoves, type ProposedMove } from '../../positions/manipulation/proposedMoves'
import { renderScene } from '.'
import { renderProposedOutcome, type ProposedOutcomeAfter, type ProposedOutcomeForm } from './renderProposedOutcome'

const pour: ProposedMove[] = [{ moved: objectId('PotTea'), from: objectId('Teapot'), to: objectId('Cup'), hostingKind: 'In' }]
const pickUpTable: ProposedMove[] = [{ moved: objectId('Table'), from: roomId('Parlour'), to: characterId('Actor') }]

const render = async (moves: readonly ProposedMove[], form: ProposedOutcomeForm, after: ProposedOutcomeAfter = 'fiction'): Promise<string> => {
    const fixture = sceneFixture('teaTable')
    const { handles } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
    const graphs = new Map(fixture.graphs.map(([hostId, payload]) => [hostId, EphemeraLudicGraph.fromFieldPayload(hostId, payload)]))
    const outcome = await dryRunProposedMoves(moves, graphs)
    if (outcome.verdict !== 'legal') {
        throw new Error(outcome.reason)
    }
    const afterCache = await buildSceneFixture({ ...fixture, graphs: [...outcome.graphs].map(([hostId, graph]) => [hostId, graph.toStored()]) })
    return renderProposedOutcome({ moves, handles, scene: afterCache.scene({ exits: fixture.exits, handleSeed: handles }).scene, form, after })
}

const pourFiction = [
    'Fiction:',
    'In the Parlour there is [table1] Table (a small round tea table).',
    'On [table1] there are [saucer1] Saucer and [teapot1] Teapot.',
    'On [saucer1] there is [cup1] Cup.',
    'In [cup1] there are [tea1] Tea and [tea2] Tea.',
    '[teapot1] is glued to [table1].',
    'You are holding nothing.',
].join('\n')

describe('renderProposedOutcome', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('shows the moves alone', async () => {
        expect(await render(pour, 'moves')).toBe('Moves:\n- [tea2] moves from [teapot1] into [cup1].')
    })

    it('shows the fiction after the moves alone', async () => {
        expect(await render(pour, 'after')).toBe(`After:\n\n${pourFiction}`)
    })

    it('shows both, moves first', async () => {
        expect(await render(pour, 'both')).toBe(`Moves:\n- [tea2] moves from [teapot1] into [cup1].\n\nAfter:\n\n${pourFiction}`)
    })

    it('repeats the graph and the rules in the whole form', async () => {
        const whole = await render(pour, 'after', 'whole')
        expect(whole).toContain(`${pourFiction}\n\nGraph:\n\`\`\`\n`)
        expect(whole).toContain('\n\nRules:\n- teapot-secured-to-table: ')
        expect(whole).not.toContain('End of scene.')
    })

    it('names the room and the actor in a move', async () => {
        expect(await render(pickUpTable, 'moves')).toBe('Moves:\n- [table1] moves from the Parlour to you.')
    })

    it('shows a proposal with no moves as the scene it already is', async () => {
        const fixture = sceneFixture('teaTable')
        const before = renderScene((await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene, 'judge')
        const fiction = (await render([], 'after')).replace('After:\n\n', '')
        expect(before).toContain(`\n\n${fiction}\n\n`)
        expect(await render([], 'moves')).toBe('Moves: none.')
    })
})
