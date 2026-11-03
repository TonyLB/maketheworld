import { calibrationJsonResponse } from '../../calibrationResponse'
import { buildSceneFixture, expectedAnswer, sceneFixtures } from '../../../dataSource/positions/ludicCache/sceneFixtures'
import { renderScene } from '../../../dataSource/actions/sceneProse'
import { probePrompt, questionText } from '../sceneReasoningPrompt'

export type SceneReasoningFixturesEvent = { type: 'SceneReasoningFixtures' }

/** No Bedrock: every fixture rendered, with its questions, the prompt each would send, and expected answers. */
export async function handleSceneReasoningFixtures(_event: SceneReasoningFixturesEvent) {
    const fixtures = await Promise.all(sceneFixtures.map(async (fixture) => {
        const { scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
        return {
            name: fixture.name,
            description: fixture.description,
            render: renderScene(scene),
            questions: fixture.questions.map((question) => ({
                question,
                text: questionText(question),
                prompt: probePrompt('<scene>', question),
                expected: expectedAnswer(scene, question),
            })),
        }
    }))
    return calibrationJsonResponse(200, { fixtures })
}
