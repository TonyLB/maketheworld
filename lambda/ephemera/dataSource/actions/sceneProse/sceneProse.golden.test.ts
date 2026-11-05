import { buildSceneFixture, sceneFixture, sceneFixtureNames } from '../../positions/ludicCache/sceneFixtures'
import { renderScene, type SceneFormat } from '.'
import { sceneAffordanceGoldens, sceneExamplesGoldens, sceneGoldens, sceneRegistersGoldens, sceneRulesGoldens } from './sceneGoldens'

/** The formats with a full golden per fixture. `affordance` and `examples` are `registers` plus one section: see below. */
const goldens: Partial<Record<SceneFormat, Record<string, string>>> = {
    D: sceneGoldens, registers: sceneRegistersGoldens,
}
const gridFormats = Object.keys(goldens) as SceneFormat[]

const renderFixture = async (name: string, format: SceneFormat): Promise<string> => {
    const fixture = sceneFixture(name)
    const { scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
    return renderScene(scene, format)
}

/** A section's golden is where it goes: after the heading line (foreground) or at the end (examples). */
const withForeground = (registers: string, section: string | undefined): string => {
    const [heading, ...rest] = registers.split('\n')
    return section === undefined ? registers : [heading, section, ...rest].join('\n')
}
const withExamples = (registers: string, section: string | undefined): string => section === undefined ? registers : `${registers}\n${section}`

describe('scene renderer: goldens', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it.each(gridFormats)('has a %s golden for every fixture', (format) => {
        expect(Object.keys(goldens[format] as Record<string, string>).sort()).toEqual([...sceneFixtureNames].sort())
    })

    it.each(gridFormats.flatMap((format) => sceneFixtureNames.map((name) => [format, name] as const)))(
        'renders %s golden of %s',
        async (format, name) => {
            expect(await renderFixture(name, format)).toBe((goldens[format] as Record<string, string>)[name])
        }
    )

    // `affordance` and `examples` differ from `registers` by one section, so only that section is pinned; the rest of
    // the render is `registers`' (above). A fixture with no entry must render exactly as `registers`.
    it.each([
        ['affordance', sceneAffordanceGoldens, withForeground],
        ['examples', sceneExamplesGoldens, withExamples],
    ] as const)('renders %s as registers plus its pinned section, for every fixture', async (format, sections, assemble) => {
        expect(Object.keys(sections).every((name) => sceneFixtureNames.includes(name))).toBe(true)
        const mismatches = (await Promise.all(sceneFixtureNames.map(async (name) => (
            (await renderFixture(name, format)) === assemble(sceneRegistersGoldens[name], sections[name]) ? undefined : name
        )))).filter((name) => name !== undefined)
        expect(mismatches).toEqual([])
    })

    it.each([
        ['rulesD', sceneGoldens],
        ['rules', sceneRegistersGoldens],
    ] as const)('renders %s as its base plus the Rules section, for every fixture with no relation in a row', async (format, bases) => {
        expect(Object.keys(sceneRulesGoldens).every((name) => sceneFixtureNames.includes(name))).toBe(true)
        const plain = await Promise.all(sceneFixtureNames.map(async (name) => {
            const fixture = sceneFixture(name)
            const { scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
            return Object.values(scene.things).every(({ relations }) => relations.length === 0) ? name : undefined
        }))
        const names = plain.filter((name): name is string => name !== undefined)
        expect(names.length).toBeGreaterThan(0)
        await Promise.all(names.map(async (name) => expect(await renderFixture(name, format)).toBe(bases[name])))
    })

    it('names the subject of each relation in a rules row, and states the securing in the section', async () => {
        const rulesD = await renderFixture('teaTable', 'rulesD')
        expect(rulesD).toContain('- [teapot1] Teapot, on [table1]; [teapot1] glued to [table1]\n')
        expect(rulesD.endsWith(sceneRulesGoldens.teaTable)).toBe(true)
        const dock = await renderFixture('dock', 'rulesD')
        expect(dock).toContain('- [boat1] Boat, in the Dock; [boat1] tied to [post1]\n')
        expect(dock).toContain('- [ladder1] Ladder, in the Dock; [ladder1] leaning against [crate1]\n')
        expect(dock).toContain('- [barrel1] Barrel, in the Dock; [barrel1] secured to [post1]\n')
        expect((await renderFixture('dock', 'rules')).endsWith(sceneRulesGoldens.dock)).toBe(true)
    })

    it.each(['rulesD', 'rules', 'rulesAction'] as const)('%s has no row reading as a self-link', async (format) => {
        expect(await renderFixture('teaTable', format)).not.toContain('[table1], glued to [table1]')
    })

    it('renders the temporary branch of rules', async () => {
        const action = await renderFixture('teaTable', 'rulesAction')
        expect(action).toContain('- [teapot1] cannot leave [table1] until [teapot1] is freed. [table1] can still be moved, because that defaults to moving [teapot1] with [table1].')
        expect(action).not.toContain('relative to')
        expect(await renderFixture('dock', 'rulesAction')).toContain('- [boat1] and [post1] cannot be moved apart until they are freed. They can still be moved together.')
    })

    it('leaves the sentences of registers and all of D as they were', async () => {
        expect(await renderFixture('teaTable', 'rules')).toContain('[teapot1] is glued to [table1].\n')
        expect(await renderFixture('teaTable', 'D')).toContain('- [teapot1] Teapot, on [table1], glued to [table1], secured\n')
    })
})
