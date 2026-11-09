/**
 * The scene fixtures: the registry, and each fixture's question set answered from its scene model. Expected answers here
 * are the Slice 0 corpus's, written in handles; a corpus answer's prose beyond its handles (a severed relation, "only its
 * end on the table") is not computed.
 */
import type { SceneAnswer } from './questions'
import { renderScene } from '../../../actions/sceneProse'
import { buildSceneFixture, expectedAnswer, sceneFixture, sceneFixtureNames, sceneFixtures, type SceneFixture } from '.'
import { buildScene } from './buildScene'
import { tavernDescription } from './tavern'

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
        undefined,
        undefined,
        handles('teapot1'),
        handles('saucer1', 'teapot1'),
        { count: 2 },
    ],
    teaTableCupOnFloor: [{ count: 2 }],
    tavernHammerOnFloor: [
        handles('saucer1', 'candle1'),
        { locations: [thing('saucer1')] },
        handles('saucer1', 'cup1', 'candle1'),
        handles('cup1'),
        handles(),
        { locations: [thing('table1')] },
    ],
}
// The oracle harness's variants change names, a held hammer or a chain to a wall, none of which `teaTable`'s questions ask about.
expected.teaTableDungeon = expected.teaTable
expected.teaTableDollHouse = expected.teaTable
expected.teaTableHammerHeld = expected.teaTable
expected.teaTableChained = expected.teaTable

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

describe('the tavern hammer dial', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('builds the held hammer as the hand-written tavern answers it', async () => {
        const answers = async (fixture: SceneFixture) => {
            const { scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
            return fixture.questions.map((question) => expectedAnswer(scene, question))
        }
        expect(await answers(buildScene(tavernDescription({ hammer: 'held' })))).toEqual(expected.tavern)
    })
})

describe('judge request sets', () => {
    const sets = sceneFixtures.flatMap((fixture) => Object.entries(fixture.judgeSets ?? {}).map(([name, requests]) => ({ fixture, name, requests })))

    it('exist for teaTable and tavern, the plan\'s Slice 4 scenes', () => {
        expect(sets.map(({ fixture, name }) => `${fixture.name}/${name}`)).toEqual(expect.arrayContaining(['teaTable/judge', 'tavern/judge']))
    })

    it.each(sets.map((entry) => [`${entry.fixture.name}/${entry.name}`, entry] as const))('%s: handles are in the scene, and tolerance never covers a wrong simple', async (_label, { fixture, requests }) => {
        const text = renderScene((await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene, 'judge')
        requests.forEach(({ request, expect: label, tolerate = [] }) => {
            ;(request.match(/\[[a-z]+\d+\]/g) ?? []).forEach((handle) => expect(text).toContain(handle))
            expect(request).toMatch(/^I want to /)
            expect(tolerate).not.toContain(label)
            if (label !== 'simple') {
                expect(tolerate).not.toContain('simple')
            }
        })
    })
})
