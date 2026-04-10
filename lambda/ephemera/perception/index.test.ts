jest.mock('../messageBus')
import messageBus from '../messageBus'
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { ephemeraDB } from "@tonylb/mtw-utilities/ts/dynamoDB"

import perceptionMessage, { sendRoomGeneratingHeader } from '.'

// @ts-ignore
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('Perception message', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should render characters correctly', async () => {
        // Create mock instance
        const mockInternalCache = {
            Global: {
                get: jest.fn().mockResolvedValue(['Base'])
            },
            CharacterMeta: {
                get: jest.fn().mockResolvedValue({
                    EphemeraId: 'CHARACTER#Test',
                    Name: 'Tess',
                    assets: ['Personal'],
                    RoomId: 'ROOM#VORTEX',
                    RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                    HomeId: 'ROOM#VORTEX',
                    Pronouns: 'she/her'
                })
            }
        } as any

        ephemeraDBMock.getItem.mockResolvedValue({
            Name: 'Tess', 
            Pronouns: 'she/her'
        })
        
        await perceptionMessage({ 
            payloads: [
                {
                    type: 'Perception',
                    characterId: 'CHARACTER#TESS',
                    ephemeraId: 'CHARACTER#TESS'
                }
            ], 
            messageBus: messageBusMock,
            internalCacheOverride: mockInternalCache
        })
        expect(ephemeraDBMock.getItem).toHaveBeenCalledWith({
            Key: {
                EphemeraId: 'CHARACTER#TESS',
                DataCategory: 'Meta::Character'
            },
            ProjectionFields: ['Name', 'Pronouns', 'fileURL', 'Color']
        })
        expect(messageBusMock.send).toHaveBeenCalledTimes(2)
        expect(messageBusMock.send).toHaveBeenCalledWith({
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
                componentUUID: 'CHARACTER#TESS'
            },
            messageGroupId: undefined
        })
    })

    describe('sendRoomGeneratingHeader', () => {
        it('should send a PerceptionMessage with generating status for room headers', () => {
            sendRoomGeneratingHeader({
                roomId: 'ROOM#TEST',
                characterIds: ['CHARACTER#TESS'],
                messageBus: messageBusMock as any,
                messageGroupId: 'UUID#group'
            })

            expect(messageBusMock.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#TESS'],
                displayProtocol: 'PerceptionMessage',
                wmlContent: `<Asset uuid=(render)>
    <Room uuid=(ROOM#TEST)>
        <Example key=(generatingHeader) uuid=(EXAMPLE#generatingHeader)>
            <DisplayName>Generating...</DisplayName>
        </Example>
    </Room>
</Asset>`,
                metaData: {
                    componentUUID: 'ROOM#TEST',
                    displayMode: 'header',
                    status: 'generating'
                },
                messageGroupId: 'UUID#group'
            })
        })

        it('should be a no-op when characterIds is empty', () => {
            sendRoomGeneratingHeader({
                roomId: 'ROOM#TEST',
                characterIds: [],
                messageBus: messageBusMock as any
            })

            expect(messageBusMock.send).not.toHaveBeenCalled()
        })
    })
})