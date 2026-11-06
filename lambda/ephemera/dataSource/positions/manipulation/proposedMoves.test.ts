import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { EphemeraLudicGraph } from '../ludicGraph'
import { buildSceneFixture, sceneFixture, type SceneFixture } from '../ludicCache/sceneFixtures'
import { characterId, objectId, roomId } from '../ludicCache/sceneFixtures/worldBuilders'
import { renderScene } from '../../actions/sceneProse'
import { dryRunProposedMoves, type ProposedMove, type ProposedMovesOutcome } from './proposedMoves'

const parlour = roomId('Parlour')
const actor = characterId('Actor')
const table = objectId('Table')
const saucer = objectId('Saucer')
const cup = objectId('Cup')
const teapot = objectId('Teapot')
const potTea = objectId('PotTea')

const graphsOf = ({ graphs }: SceneFixture) => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>(
    graphs.map(([hostId, payload]) => [hostId, EphemeraLudicGraph.fromFieldPayload(hostId, payload)])
)

const legalGraphs = (outcome: ProposedMovesOutcome) => {
    if (outcome.verdict !== 'legal') {
        throw new Error(`Expected a legal outcome, got: ${outcome.reason}`)
    }
    return outcome.graphs
}

/** The fixture's scene after the moves, by the fold every scene takes. */
const fictionAfter = async (fixture: SceneFixture, moves: readonly ProposedMove[]): Promise<string> => {
    const graphs = legalGraphs(await dryRunProposedMoves(moves, graphsOf(fixture)))
    const after = await buildSceneFixture({ ...fixture, graphs: [...graphs].map(([hostId, graph]) => [hostId, graph.toStored()]) })
    const text = renderScene(after.scene({ exits: fixture.exits }).scene, 'judge')
    return text.slice(text.indexOf('Fiction:'), text.indexOf('\n\nGraph:'))
}

describe('dryRunProposedMoves', () => {
    const teaTable = sceneFixture('teaTable')

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('takes the table into the hand, with what is on it', async () => {
        const fiction = await fictionAfter(teaTable, [{ moved: table, from: parlour, to: actor }])
        expect(fiction).toContain('You are holding [table1] Table')
        expect(fiction).toContain('On [table1] there are [saucer1] Saucer and [teapot1] Teapot.')
        expect(fiction).toContain('[teapot1] is glued to [table1].')
    })

    it('takes the cup into the hand, and leaves the saucer on the table', async () => {
        const fiction = await fictionAfter(teaTable, [{ moved: cup, from: saucer, to: actor }])
        expect(fiction).toContain('You are holding [cup1] Cup')
        expect(fiction).not.toContain('On [saucer1]')
    })

    it('pours the teapot\'s tea into the cup', async () => {
        const fiction = await fictionAfter(teaTable, [{ moved: potTea, from: teapot, to: cup, hostingKind: 'In' }])
        expect(fiction).toContain('In [cup1] there are [tea1] Tea and [tea2] Tea.')
        expect(fiction).not.toContain('In [teapot1]')
    })

    it('moves the table into a cup that is on the floor, which only the sizes argue with', async () => {
        const fiction = await fictionAfter(sceneFixture('teaTableCupOnFloor'), [{ moved: table, from: parlour, to: cup, hostingKind: 'In' }])
        expect(fiction).toContain('[table1] Table')
        expect(fiction).toContain('On [table1] there are [saucer1] Saucer and [teapot1] Teapot.')
        expect(fiction).toMatch(/In \[cup1\] there are .*\[table1\] Table/)
    })

    it('needs the before scene\'s handles once the walk reaches things in another order', async () => {
        const graphs = legalGraphs(await dryRunProposedMoves([{ moved: cup, from: saucer, to: actor }], graphsOf(teaTable)))
        const after = await buildSceneFixture({ ...teaTable, graphs: [...graphs].map(([hostId, graph]) => [hostId, graph.toStored()]) })
        const before = (await buildSceneFixture(teaTable)).scene()
        const handleOf = ({ handles }: typeof before, id: string) => handles.find((entry) => entry.id === id)?.handle
        expect(handleOf(before, 'OBJECT#CupTea')).toBe('tea1')
        expect(handleOf(after.scene(), 'OBJECT#CupTea')).toBe('tea2')
        const seeded = after.scene({ handleSeed: before.handles })
        expect(handleOf(seeded, 'OBJECT#CupTea')).toBe('tea1')
        expect(seeded.handles.map(({ handle }) => handle).sort()).toEqual(before.handles.map(({ handle }) => handle).sort())
    })

    it('leaves the graphs as they were for a proposal with no moves', async () => {
        const graphs = graphsOf(teaTable)
        expect(legalGraphs(await dryRunProposedMoves([], graphs))).toBe(graphs)
    })

    it('refuses a move a securing holds, naming the move', async () => {
        const move = { moved: teapot, from: table, to: actor }
        expect(await dryRunProposedMoves([move], graphsOf(teaTable))).toEqual({ verdict: 'refused', move, reason: 'securedToBlocksMove' })
    })

    it('refuses a move into something the mover holds', async () => {
        const move = { moved: table, from: parlour, to: cup, hostingKind: 'In' as const }
        expect(await dryRunProposedMoves([move], graphsOf(teaTable))).toEqual({ verdict: 'refused', move, reason: 'containmentCycle' })
    })

    it('plans each move against what the moves before it left', async () => {
        const moves = [{ moved: cup, from: saucer, to: actor }, { moved: cup, from: actor, to: table }]
        const fiction = await fictionAfter(teaTable, moves)
        expect(fiction).toContain('[cup1] Cup')
        expect(fiction).toContain('You are holding nothing.')
    })

    it('refuses a move from somewhere the mover is not', async () => {
        const move = { moved: cup, from: actor, to: table }
        expect(await dryRunProposedMoves([move], graphsOf(teaTable))).toEqual({ verdict: 'refused', move, reason: 'moverNotOnFromHost' })
    })
})
