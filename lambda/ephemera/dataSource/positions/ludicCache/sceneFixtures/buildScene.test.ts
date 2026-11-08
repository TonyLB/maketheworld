/**
 * The fixture builder: a description built through population comes out as the hand-written graphs, node order included.
 */
import { buildScene, type SceneDescription } from './buildScene'
import { teaTableCupOnFloorDescription, teaTableCupOnFloorScene, teaTableDescription, teaTableScene } from './teaTable'
import { characterId, conceptId, featureId, objectId, roomId, type SceneFixture } from './worldBuilders'

const byHost = (graphs: SceneFixture['graphs']) => new Map(graphs)

describe('buildScene', () => {
    it.each([
        ['teaTable', teaTableDescription, teaTableScene],
        ['teaTableCupOnFloor', teaTableCupOnFloorDescription, teaTableCupOnFloorScene],
    ] as const)('builds %s as the hand-written graphs', (_name, description, scene) => {
        expect(byHost(buildScene(description).graphs)).toEqual(byHost(scene.graphs))
    })

    it('replaces names entry by entry and changes nothing else', () => {
        const plain = buildScene(teaTableDescription)
        const themed = buildScene(teaTableDescription, { names: { [objectId('Table')]: { shortName: 'Altar', gloss: 'a slab of black stone' } } })
        expect(themed.names[objectId('Table')]).toEqual({ shortName: 'Altar', gloss: 'a slab of black stone' })
        expect({ ...themed, names: plain.names }).toEqual(plain)
    })

    const room = roomId('Hall')
    const bare = (placements: SceneDescription['placements']): SceneDescription => ({
        name: 'bare', description: 'a test scene', roomId: room, actorId: characterId('Actor'), names: {}, questions: [], placements,
    })

    it('refuses a placement under a host not placed yet', () => {
        expect(() => buildScene(bare([{ thing: objectId('Cup'), host: objectId('Table') }]))).toThrow(/not placed yet/)
    })

    it('refuses a kind the pairing rule refuses (population throws)', () => {
        expect(() => buildScene(bare([{ thing: objectId('Cup'), host: characterId('Actor'), hostingKind: 'In' }]))).toThrow(/not legal/)
    })

    it('names a further binding as the description asks, and refuses one with no name', () => {
        const hearth = featureId('Hearth')
        const warmth = conceptId('Warmth')
        const twice = (bindingName?: string) => bare([
            { thing: hearth, host: room },
            { thing: warmth, host: room },
            { thing: warmth, host: hearth, bindingName },
        ])
        expect(() => buildScene(twice())).toThrow(/needs a bindingName/)
        expect(byHost(buildScene(twice('atHearth')).graphs).get(warmth)?.nodes).toContainEqual(expect.objectContaining({
            universalKey: 'PRESENCE#atHearth', fromHostPresences: [{ host: hearth, presence: 'PRESENCE#Base' }],
        }))
    })

    it('places a thing in the actor\'s hand, Held, under the actor\'s one Base', () => {
        const hammer = objectId('Hammer')
        const graphs = byHost(buildScene(bare([{ thing: hammer, host: characterId('Actor') }])).graphs)
        expect(graphs.get(characterId('Actor'))?.nodes).toContainEqual({ tag: 'Object', universalKey: hammer, hostingKind: 'Held' })
        expect(graphs.get(hammer)?.nodes).toContainEqual(expect.objectContaining({
            universalKey: 'PRESENCE#Base', fromHostPresences: [{ host: characterId('Actor'), presence: 'PRESENCE#Base' }],
        }))
    })
})
