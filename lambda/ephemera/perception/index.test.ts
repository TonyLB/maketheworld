jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid'),
}))
const mockGetCurrentTimestamp = jest.fn(() => 1000000000000)
jest.mock('../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: () => mockGetCurrentTimestamp(),
}))
jest.mock('../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../internalCache/hydrateRoomRoster', () => ({
    getRoomCharacterList: jest.fn(),
}))
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import messageBus from '../messageBus'
import '../dataSource/perception'
import publishMessage from '../publishMessage'

import type { EphemeraCacheDynamoItem } from '../dataSource/renderCache/baseClasses'
import { roomHeaderChannelWmlForRoomId, roomRenderChannelWmlForRoomId } from '../dataSource/perception/roomRenderWmlFromCacheRecord'
import perceptionMessage, { sendRoomGeneratingHeader } from '.'

const publishMessageMock = publishMessage as jest.MockedFunction<typeof publishMessage>

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('Perception message', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetCurrentTimestamp.mockReturnValue(1000000000000)
        messageBus.clear()
    })

    it('should render characters correctly', async () => {
        const mockInternalCache = {
            Global: {
                get: jest.fn().mockResolvedValue(['Base']),
            },
            CharacterMeta: {
                get: jest.fn().mockResolvedValue({
                    EphemeraId: 'CHARACTER#Test',
                    Name: 'Tess',
                    assets: ['Personal'],
                    RoomId: 'ROOM#VORTEX',
                    RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                    HomeId: 'ROOM#VORTEX',
                    Pronouns: 'she/her',
                }),
            },
        } as any

        ephemeraDBMock.getItem.mockResolvedValue({
            Name: 'Tess',
            Pronouns: 'she/her',
        })

        await perceptionMessage({
            payloads: [
                {
                    type: 'Perception',
                    characterId: 'CHARACTER#TESS',
                    ephemeraId: 'CHARACTER#TESS',
                },
            ],
            messageBus,
            internalCacheOverride: mockInternalCache,
        })
        await messageBus.flushAndSettle()

        expect(ephemeraDBMock.getItem).toHaveBeenCalledWith({
            Key: {
                EphemeraId: 'CHARACTER#TESS',
                DataCategory: 'Meta::Character',
            },
            ProjectionFields: ['Name', 'Pronouns', 'fileURL', 'Color'],
        })
        expect(publishMessageMock).toHaveBeenCalledWith(
            expect.objectContaining({
                payloads: [
                    expect.objectContaining({
                        type: 'PublishMessage',
                        displayProtocol: 'PerceptionMessage',
                        targets: ['CHARACTER#TESS'],
                        wmlContent: `<Asset uuid=(render)>
    <Character uuid=(CHARACTER#TESS)>
        <DisplayName>Tess</DisplayName>
        <Pronouns>she/her</Pronouns>
        
    </Character>
</Asset>`,
                        metaData: {
                            componentUUID: 'CHARACTER#TESS',
                        },
                    }),
                ],
            })
        )
    })

    describe('PerceptionRoomMessage', () => {
        const roomId = 'ROOM#HALL' as const

        const sampleCacheRow: EphemeraCacheDynamoItem = {
            EphemeraId: roomId,
            DataCategory: 'CACHE#x0',
            markState: { markValue: [] },
            renderedContent: {
                displayName: ['Foyer'],
                description: ['A bright entry.'],
            },
            provenance: { type: 'authored' },
            perspectiveId: 'pid',
            perspectiveMatcher: { assetStack: [] } as any,
        }

        it('builds wml from RenderCache first row (no ComponentRender get)', async () => {
            const renderCacheGet = jest.fn().mockResolvedValue([sampleCacheRow])
            const mockInternalCache = {
                RenderCache: { get: renderCacheGet },
                ComponentRender: { get: jest.fn() },
            } as any

            await perceptionMessage({
                payloads: [
                    {
                        type: 'Perception',
                        characterId: 'CHARACTER#TESS',
                        ephemeraId: roomId,
                        header: true,
                    },
                ],
                messageBus,
                internalCacheOverride: mockInternalCache,
            })
            await messageBus.flushAndSettle()

            expect(mockInternalCache.ComponentRender.get).not.toHaveBeenCalled()
            expect(renderCacheGet).toHaveBeenCalledWith(roomId)
            const expectedWml = roomHeaderChannelWmlForRoomId(roomId, [sampleCacheRow])
            expect(publishMessageMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    payloads: [
                        expect.objectContaining({
                            type: 'PublishMessage',
                            targets: ['CHARACTER#TESS'],
                            displayProtocol: 'PerceptionMessage',
                            wmlContent: expectedWml,
                            metaData: {
                                componentUUID: roomId,
                                displayMode: 'header',
                                roomChannel: 'render',
                            },
                        }),
                    ],
                })
            )
            expect(expectedWml).not.toMatch(/<Exit\b/i)
        })

        it('uses empty-cache prose when RenderCache has no rows', async () => {
            const renderCacheGet = jest.fn().mockResolvedValue([])
            const mockInternalCache = {
                RenderCache: { get: renderCacheGet },
                ComponentRender: { get: jest.fn() },
            } as any
            const expectedWml = roomRenderChannelWmlForRoomId(roomId, [])

            await perceptionMessage({
                payloads: [
                    { type: 'Perception', characterId: 'CHARACTER#TESS', ephemeraId: roomId },
                ],
                messageBus,
                internalCacheOverride: mockInternalCache,
            })
            await messageBus.flushAndSettle()

            expect(publishMessageMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    payloads: [
                        expect.objectContaining({
                            wmlContent: expectedWml,
                            metaData: expect.objectContaining({ displayMode: 'full' }),
                        }),
                    ],
                })
            )
        })
    })

    describe('sendRoomGeneratingHeader', () => {
        const messageBusMock = { publish: jest.fn() } as any

        it('should send a PerceptionMessage with generating status for room headers', () => {
            sendRoomGeneratingHeader({
                roomId: 'ROOM#TEST',
                characterIds: ['CHARACTER#TESS'],
                messageBus: messageBusMock,
                messageGroupId: 'UUID#group',
            })

            expect(messageBusMock.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'PublishMessage',
                    targets: ['CHARACTER#TESS'],
                    displayProtocol: 'PerceptionMessage',
                    wmlContent: `<Asset uuid=(render)>
    <Room uuid=(ROOM#TEST)>
        <Render>
            <DisplayName>Generating...</DisplayName>
            <Summary></Summary>
            <Description></Description>
        </Render>
    </Room>
</Asset>`,
                    metaData: {
                        componentUUID: 'ROOM#TEST',
                        displayMode: 'header',
                        status: 'generating',
                        roomChannel: 'render',
                    },
                    messageGroupId: 'UUID#group',
                    createdTime: 1000000000000,
                })
            )
            expect((messageBusMock.publish as jest.Mock).mock.calls[0][0].messageId).toBe('MESSAGE#test-uuid')
        })

        it('should be a no-op when characterIds is empty', () => {
            jest.clearAllMocks()
            sendRoomGeneratingHeader({
                roomId: 'ROOM#TEST',
                characterIds: [],
                messageBus: messageBusMock,
            })

            expect(messageBusMock.publish).not.toHaveBeenCalled()
        })
    })
})
