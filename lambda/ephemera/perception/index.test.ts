jest.mock('../messageBus')
import messageBus from '../messageBus'
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { ephemeraDB } from "@tonylb/mtw-utilities/ts/dynamoDB"

import perceptionMessage from '.'
import StandardMessage from "@tonylb/mtw-wml/ts/standardize/components/message"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardReference } from "@tonylb/mtw-wml/ts/standardize/components/reference"

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
            displayProtocol: 'CharacterDescription',
            targets: ['CHARACTER#TESS'],
            CharacterId: 'CHARACTER#TESS',
            Name: 'Tess', 
            Pronouns: 'she/her'
        })
    })

    describe('messageTag', () => {
        it('should render message tag correctly to a single character', async () => {
            // Create mock instance
            const mockInternalCache = {
                Global: {
                    get: jest.fn().mockResolvedValue(['Base'])
                },
                CharacterMeta: {
                    get: jest.fn().mockResolvedValue({
                        EphemeraId: 'CHARACTER#TESS',
                        Name: 'Tess',
                        assets: ['Personal'],
                        RoomId: 'ROOM#VORTEX',
                        RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                        HomeId: 'ROOM#VORTEX',
                        Pronouns: 'she/her'
                    })
                },
                ComponentMeta: {
                    getAcrossAssets: jest.fn().mockResolvedValue({
                        ['ASSET#Base']: new StandardMessage(`
                            <Message uuid=(Test) key=(testMessage)>
                                <Room uuid=(VORTEX) />
                                <Room uuid=(ABC) />
                                Test Message
                            </Message>
                        `)
                    })
                },
                ComponentRender: {
                    get: jest.fn().mockResolvedValue(new StandardForm(`
                        <Asset key=(render)>
                            <Message uuid=(Test)>
                                <Room uuid=(VORTEX) />
                                <Room uuid=(ABC) />
                                Test Message
                            </Message>
                        </Asset>
                    `))
                }
            } as any

            await perceptionMessage({ 
                payloads: [
                    {
                        type: 'Perception',
                        characterId: 'CHARACTER#TESS',
                        ephemeraId: 'MESSAGE#Test',
                        messageGroupId: 'UUID#1'
                    }
                ], 
                messageBus: messageBusMock,
                internalCacheOverride: mockInternalCache
            })
            
            expect(messageBusMock.send).toHaveBeenCalledTimes(2)
            expect(messageBusMock.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                displayProtocol: 'WorldMessage',
                targets: ['CHARACTER#TESS'],
                message: ['Test Message'],
                messageGroupId: 'UUID#1'
            })
        })

        it('should not render when character is not in a messaged room', async () => {
            // Create mock instance
            const mockInternalCache = {
                Global: {
                    get: jest.fn().mockResolvedValue(['Base'])
                },
                CharacterMeta: {
                    get: jest.fn().mockResolvedValue({
                        EphemeraId: 'CHARACTER#TESS',
                        Name: 'Tess',
                        assets: ['Personal'],
                        RoomId: 'ROOM#VORTEX',
                        RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                        HomeId: 'ROOM#VORTEX',
                        Pronouns: 'she/her'
                    })
                },
                ComponentMeta: {
                    getAcrossAssets: jest.fn().mockResolvedValue({
                        ['ASSET#Base']: new StandardMessage(`
                            <Message uuid=(Test) key=(testMessage)>
                                <Room uuid=(ABC) />
                                Test Message
                            </Message>
                        `)
                    })
                },
                ComponentRender: {
                    get: jest.fn().mockResolvedValue(new StandardForm(`
                        <Asset key=(render)>
                            <Message uuid=(Test)>
                                <Room uuid=(ABC) />
                                Test Message
                            </Message>
                        </Asset>
                    `))
                }
            } as any

            await perceptionMessage({ 
                payloads: [
                    {
                        type: 'Perception',
                        characterId: 'CHARACTER#TESS',
                        ephemeraId: 'MESSAGE#Test'
                    }
                ], 
                messageBus: messageBusMock,
                internalCacheOverride: mockInternalCache
            })
            expect(messageBusMock.send).toHaveBeenCalledTimes(1)
        })

        it('should not render when render tag delivers no contents', async () => {
            // Create mock instance
            const mockInternalCache = {
                Global: {
                    get: jest.fn().mockResolvedValue(['Base'])
                },
                CharacterMeta: {
                    get: jest.fn().mockResolvedValue({
                        EphemeraId: 'CHARACTER#TESS',
                        Name: 'Tess',
                        assets: ['Personal'],
                        RoomId: 'ROOM#VORTEX',
                        RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                        HomeId: 'ROOM#VORTEX',
                        Pronouns: 'she/her'
                    })
                },
                ComponentMeta: {
                    getAcrossAssets: jest.fn().mockResolvedValue({
                        ['ASSET#Base']: new StandardMessage(`
                            <Message uuid=(Test) key=(testMessage)>
                                <Room uuid=(VORTEX) />
                                <Room uuid=(ABC) />
                                Test Message
                            </Message>
                        `)
                    })
                },
                ComponentRender: {
                    get: jest.fn().mockResolvedValue(new StandardForm(`
                        <Asset key=(render)>
                            <Message uuid=(Test)>
                                <Room uuid=(ABC) />
                                <Room uuid=(VORTEX) />
                            </Message>
                        </Asset>
                    `))
                }
            } as any

            await perceptionMessage({ 
                payloads: [
                    {
                        type: 'Perception',
                        characterId: 'CHARACTER#TESS',
                        ephemeraId: 'MESSAGE#Test'
                    }
                ], 
                messageBus: messageBusMock,
                internalCacheOverride: mockInternalCache
            })
            expect(messageBusMock.send).toHaveBeenCalledTimes(1)
        })

    })
})