import messageBus from '../../../messageBus'
import { isPublishMessage, isPublishWorldLineMessage } from '../../../messageBus/baseClasses'
import { buildSceneFixture, sceneFixture } from '../../positions/ludicCache/sceneFixtures'
import { renderScene } from '../sceneProse'
import { runSceneTestHarness } from './runSceneTestHarness'

jest.mock('../../../messageBus')

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>

function publishedText(): string {
    expect(mockMessageBus.publish).toHaveBeenCalledTimes(1)
    const payload = mockMessageBus.publish.mock.calls[0][0]
    if (!isPublishMessage(payload) || !isPublishWorldLineMessage(payload)) {
        throw new Error('expected WorldOOCMessage')
    }
    expect(payload.displayProtocol).toBe('WorldOOCMessage')
    expect(payload.targets).toEqual(['CHARACTER#t'])
    return payload.message.filter((item): item is string => typeof item === 'string').join('\n')
}

describe('runSceneTestHarness', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockMessageBus.publish.mockReturnValue(undefined)
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('publishes one OOC message: the rendered scene, then every handle with its id', async () => {
        const actorCache = await buildSceneFixture(sceneFixture('tavern'))
        const { scene, handles } = actorCache.scene()

        runSceneTestHarness({ characterId: 'CHARACTER#t', messageBus, actorCache })

        const text = publishedText()
        expect(text).toContain(renderScene(scene))
        expect(text).toContain('Handles (never shown to the reader):')
        expect(handles.length).toBeGreaterThan(0)
        handles.forEach(({ handle, id }) => expect(text).toContain(`- [${handle}] -> ${id}`))
        expect(text.indexOf(renderScene(scene))).toBeLessThan(text.indexOf('Handles ('))
    })

    it('says so when the character is in no room', () => {
        runSceneTestHarness({ characterId: 'CHARACTER#t', messageBus })
        expect(publishedText()).toContain('you are not in a room')
    })
})
