import { ephemeraActionsDataSource } from './index'
import messageBus from '../../messageBus'
import internalCache from '../../internalCache'
import { getRoomExitTargetsForCharacter } from './roomExitTargetsForCharacter'
import { getActorCache } from './actorObjectCatalog'
import { collectCoyoteOccupiedStableKeys } from './stableKey/collectCoyoteOccupiedStableKeys'
import { buildSceneFixture, sceneFixture } from '../positions/ludicCache/sceneFixtures'
import { sceneFanGoldens, sceneGoldens } from './sceneProse/sceneGoldens'

/**
 * The `/test scene` payoff: the command through the real parse and response, from a real fold of the `tavern` scene fixture
 * to the one OOC message the bus publishes. Only the leaves are faked: the world readers and the bus.
 */

jest.mock('../../messageBus')
jest.mock('../../internalCache')
jest.mock('./roomExitTargetsForCharacter', () => ({
    ...(jest.requireActual('./roomExitTargetsForCharacter') as object),
    getRoomExitTargetsForCharacter: jest.fn(),
}))
jest.mock('./actorObjectCatalog', () => ({
    getActorCache: jest.fn(),
}))
jest.mock('./stableKey/collectCoyoteOccupiedStableKeys', () => ({ collectCoyoteOccupiedStableKeys: jest.fn() }))

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('scene test payoff: /test scene publishes the actor\'s scene', () => {
    const characterId = 'CHARACTER#Tess'

    const receive = async (command: string) => {
        await ephemeraActionsDataSource.receiveEvents!({
            events: [{
                header: { dataSourceKey: 'api.ephemera', streamKey: characterId, timestamp: Date.now(), type: 'Parse Requested' },
                getContent: async () => ({ characterId, command }),
            }] as any,
            streamEvent: jest.fn(async () => {}),
            streamEnvelope: jest.fn(async () => {}),
        } as any)
    }
    const published = () => mockMessageBus.publish.mock.calls.map(([call]) => call as any)
    const oocText = () => published()
        .filter(({ displayProtocol }) => displayProtocol === 'WorldOOCMessage')
        .map(({ message }) => message.filter((item: unknown) => typeof item === 'string').join('\n'))

    beforeEach(async () => {
        jest.clearAllMocks()
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
        mockMessageBus.publish.mockReturnValue(undefined)
        const fixture = sceneFixture('tavern')
        const actorCache = await buildSceneFixture(fixture)
        ;(getRoomExitTargetsForCharacter as jest.Mock).mockResolvedValue({ fromRoomId: null, toRoomIds: [], exits: [] })
        ;(getActorCache as jest.Mock).mockResolvedValue(actorCache)
        ;(collectCoyoteOccupiedStableKeys as jest.Mock).mockResolvedValue(new Set<string>())
        internalCacheMock.ObjectEmbedding.get.mockResolvedValue({})
    })
    afterEach(() => jest.restoreAllMocks())

    it('publishes one OOC message holding the rendered scene (no exits) and the handle table', async () => {
        await receive('/test scene')

        const [text, ...rest] = oocText()
        expect(rest).toEqual([])
        const golden = sceneGoldens.tavern.replace(/\nExits: .*$/, '')
        expect(text).toContain(golden)
        expect(text).not.toContain('Exits:')
        expect(text).toMatch(/- \[table1\] -> OBJECT#/)
        expect(text).toMatch(/- \[cup1\] -> OBJECT#/)
    })

    it('renders in the format named in the tail', async () => {
        await receive('/test scene fans')

        const [text, ...rest] = oocText()
        expect(rest).toEqual([])
        expect(text).toContain(sceneFanGoldens.tavern.replace(/\nExits: .*$/, ''))
    })

    it('refuses an unknown format as a command error, with no scene', async () => {
        await receive('/test scene tavern')

        const [text, ...rest] = oocText()
        expect(rest).toEqual([])
        expect(text).toContain('unrecognized format')
        expect(text).not.toContain('Contents of')
    })
})
