jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import messageBus from '../messageBus'
import '../dataSource/perception'

import perceptionMessage, { sendRoomGeneratingHeader } from '.'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('Perception message', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
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

        const sendSpy = jest.spyOn(messageBus, 'send')

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
        await messageBus.flush()

        expect(ephemeraDBMock.getItem).toHaveBeenCalledWith({
            Key: {
                EphemeraId: 'CHARACTER#TESS',
                DataCategory: 'Meta::Character',
            },
            ProjectionFields: ['Name', 'Pronouns', 'fileURL', 'Color'],
        })
        expect(sendSpy).toHaveBeenCalledWith({
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
            messageGroupId: undefined,
        })
        sendSpy.mockRestore()
    })

    describe('sendRoomGeneratingHeader', () => {
        const messageBusMock = { send: jest.fn() } as any

        it('should send a PerceptionMessage with generating status for room headers', () => {
            sendRoomGeneratingHeader({
                roomId: 'ROOM#TEST',
                characterIds: ['CHARACTER#TESS'],
                messageBus: messageBusMock,
                messageGroupId: 'UUID#group',
            })

            expect(messageBusMock.send).toHaveBeenCalledWith({
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
                },
                messageGroupId: 'UUID#group',
            })
        })

        it('should be a no-op when characterIds is empty', () => {
            jest.clearAllMocks()
            sendRoomGeneratingHeader({
                roomId: 'ROOM#TEST',
                characterIds: [],
                messageBus: messageBusMock,
            })

            expect(messageBusMock.send).not.toHaveBeenCalled()
        })
    })
})
