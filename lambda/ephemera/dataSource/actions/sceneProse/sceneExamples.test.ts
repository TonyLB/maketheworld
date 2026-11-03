import type { SceneQuestion } from '../../positions/ludicCache/sceneFixtures'
import { buildSceneFixture, sceneFixture, sceneFixtureNames } from '../../positions/ludicCache/sceneFixtures'
import { exampleHandles } from './renderSceneRegisters'

/** Every handle a question names: its typed fields and anything bracketed in its wording. */
const questionHandles = (question: SceneQuestion): string[] => {
    const typed = [
        ...('subject' in question && question.subject !== undefined ? [question.subject] : []),
        ...('target' in question ? [question.target] : []),
    ]
    const worded = (question.asked ?? '').match(/\[[^\]]+\]/g)?.map((text) => text.slice(1, -1)) ?? []
    return [...typed, ...worded]
}

describe('worked examples and probe questions', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    // The examples are about the scene's own things, so a question about those same things would be answered by the example.
    // Fixtures keep at least one question clear of them for every fixture whose scene gets an example.
    it('leaves every fixture a probe question clear of its example subjects', async () => {
        const lacking = (await Promise.all(sceneFixtureNames.map(async (name) => {
            const fixture = sceneFixture(name)
            const { scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
            const subjects = exampleHandles(scene)
            const clear = fixture.questions.filter((question) => !questionHandles(question).some((handle) => subjects.includes(handle)))
            return subjects.length > 0 && clear.length === 0 ? name : undefined
        }))).filter((name) => name !== undefined)
        expect(lacking).toEqual([])
    })
})
