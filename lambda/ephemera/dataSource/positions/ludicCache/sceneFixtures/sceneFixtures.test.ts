/**
 * The scene fixtures: the registry, and each fixture's question set answered from its scene model. Expected answers here
 * are the Slice 0 corpus's, written in handles; a corpus answer's prose beyond its handles (a severed relation, "only its
 * end on the table") is not computed.
 */
import type { SceneAnswer } from './questions'
import { buildSceneFixture, expectedAnswer, sceneFixture, sceneFixtureNames, sceneFixtures } from '.'

const handles = (...values: string[]): SceneAnswer => ({ handles: values })
const thing = (handle: string, hostingKind: 'On' | 'In' | 'Held' = 'On') => ({ kind: 'thing' as const, handle, hostingKind })

const expected: Record<string, (SceneAnswer | undefined)[]> = {
    tavern: [
        handles('saucer1', 'candle1'),
        { locations: [thing('saucer1')] },
        handles('saucer1', 'cup1', 'candle1'),
        handles('cup1'),
        handles('hammer1'),
        { locations: [thing('table1')] },
    ],
    siblingFan: [
        handles('fork1', 'knife1', 'plate1', 'cup1'),
        { locations: [thing('table1')] },
        handles(),
    ],
    branchInBranch: [
        handles('saucer1', 'candle1', 'tray1'),
        handles('teapot1', 'jug1'),
        { locations: [thing('tray1')] },
        { locations: [thing('table1')] },
        handles('teapot1', 'jug1'),
    ],
    deepChain: [
        { locations: [thing('bag1', 'In')] },
        { locations: [thing('bag1', 'In'), thing('box1', 'In'), thing('table1'), { kind: 'room' }] },
        handles('box1'),
        handles('bag1', 'coin1'),
    ],
    lab: [
        handles('cup1', 'spring1'),
        { targets: [{ kind: 'thing', handle: 'cup1' }] },
        handles('spring1'),
        handles('cup1', 'spring1'),
        { locations: [{ kind: 'room' }, { kind: 'otherRoom' }] },
    ],
    heldInventory: [
        handles('bag1', 'rope1'),
        { locations: [thing('table1'), { kind: 'held' }] },
        { locations: [thing('bag1', 'In')] },
        { targets: [{ kind: 'thing', handle: 'coin1' }] },
        handles('rope1'),
        handles('lamp1', 'rope1'),
    ],
    twoCups: [
        handles('cup1'),
        { locations: [{ kind: 'room' }] },
        handles('cup1'),
        { locations: [{ kind: 'room' }] },
    ],
    dock: [
        handles('boat1'),
        handles('boat1', 'barrel1'),
        { targets: [{ kind: 'thing', handle: 'crate1' }] },
        handles(),
        handles('boat1', 'barrel1'),
    ],
    openLegs: [
        { targets: [{ kind: 'thing', handle: 'bag1' }, { kind: 'someoneElse' }] },
        handles('table1'),
        handles('lamp1', 'rope1'),
    ],
    drapedCloth: [
        { locations: [thing('table1'), { kind: 'room' }] },
        { count: 1 },
        handles('cloth1'),
    ],
    unnamed: [
        { locations: [thing('object1', 'In')] },
        { targets: [{ kind: 'thing', handle: 'object1' }] },
        handles('key1'),
    ],
    emptyRoom: [
        handles(),
        handles(),
    ],
    steamerChest: [
        handles('backgammon-set1', 'chess-set1'),
        handles('inherited-furniture1', 'boardgames1'),
        handles('steamer-chest1'),
        handles('backgammon-set1', 'die1', 'chess-set1'),
        handles('spare-die1'),
    ],
    join: [
        handles('napkin1', 'fruit-bowl1'),
        { locations: [thing('tablecloth1')] },
        handles('apple1'),
        handles('pear1'),
    ],
    feature: [
        handles('altar1', 'hymnal1'),
        handles('candle1'),
        { locations: [thing('altar1')] },
    ],
    sideboard: [
        handles('candle1', 'saucer1', 'mug1', 'tray1', 'box1', 'lamp1'),
        handles('cup1'),
        handles('coffee1'),
        { locations: [thing('cup1', 'In')] },
        { locations: [thing('sideboard1')] },
        handles('cup1', 'tea1'),
        handles('fork1', 'knife1', 'spoon1'),
    ],
    teaTable: [
        undefined,
        undefined,
        undefined,
        handles('teapot1'),
        handles('saucer1', 'teapot1'),
        { count: 2 },
    ],
}

describe('scene fixtures', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('names each fixture once, and refuses an unknown name by listing the valid ones', () => {
        expect(new Set(sceneFixtureNames).size).toBe(sceneFixtures.length)
        expect(sceneFixture('tavern').name).toBe('tavern')
        expect(() => sceneFixture('nowhere')).toThrow(`Unknown scene fixture "nowhere"; expected one of: ${sceneFixtureNames.join(', ')}`)
    })

    it('has an expected-answer row for every fixture', () => {
        expect(Object.keys(expected).sort()).toEqual([...sceneFixtureNames].sort())
    })

    it.each(sceneFixtureNames)('%s: every question is answered from the scene model as the corpus expects', async (name) => {
        const fixture = sceneFixture(name)
        const { scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })

        expect(fixture.questions.map((question) => expectedAnswer(scene, question))).toEqual(expected[name])
    })
})
