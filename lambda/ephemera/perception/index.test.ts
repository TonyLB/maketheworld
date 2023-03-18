jest.mock('../internalCache')
import internalCache from "../internalCache"
jest.mock('../messageBus')
import messageBus from '../messageBus'
jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import perceptionMessage from '.'

const cacheMock = jest.mocked(internalCache, true)
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('Perception message', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should render characters correctly', async () => {
        cacheMock.Global.get.mockResolvedValue(['Base'])
        cacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: ['Personal'],
            RoomId: 'ROOM#VORTEX',
            HomeId: 'ROOM#VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        ephemeraDBMock.getItem.mockResolvedValue({
            Name: 'Tess', 
            FirstImpression: 'Testy',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        await perceptionMessage({ payloads: [
            {
                type: 'Perception',
                characterId: 'CHARACTER#TESS',
                ephemeraId: 'CHARACTER#TESS'
            }
        ], messageBus: messageBusMock })
        expect(ephemeraDBMock.getItem).toHaveBeenCalledWith({
            EphemeraId: 'CHARACTER#TESS',
            DataCategory: 'Meta::Character',
            ProjectionFields: ['#name', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit', 'fileURL', 'Color'],
            ExpressionAttributeNames: {
                '#name': 'Name'
            }
        })
        expect(messageBusMock.send).toHaveBeenCalledTimes(2)
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'PublishMessage',
            displayProtocol: 'CharacterDescription',
            targets: ['CHARACTER#TESS'],
            CharacterId: 'CHARACTER#TESS',
            Name: 'Tess', 
            FirstImpression: 'Testy',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
    })

    describe('messageTag', () => {
        it('should render message tag correctly to a single character', async () => {
            cacheMock.Global.get.mockResolvedValue(['Base'])
            cacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#TESS',
                Name: 'Tess',
                assets: ['Personal'],
                RoomId: 'ROOM#VORTEX',
                HomeId: 'ROOM#VORTEX',
                Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
            })
            cacheMock.ComponentMeta.getAcrossAssets.mockResolvedValue({
                Base: {
                    EphemeraId: 'MESSAGE#Test',
                    assetId: 'Base',
                    appearances: [{
                        render: [{
                            tag: 'String',
                            value: 'Test Message'
                        }],
                        rooms: ['ROOM#VORTEX', 'ROOM#ABC'],
                        conditions: []
                    }],
                    key: 'testMessage'
                }
            })
            cacheMock.ComponentRender.get.mockResolvedValue({
                Description: [{
                    tag: 'String',
                    value: 'Test Message'
                }],
                MessageId: 'MESSAGE#Test',
                rooms: ['ROOM#VORTEX', 'ROOM#ABC']
            })
            await perceptionMessage({ payloads: [
                {
                    type: 'Perception',
                    characterId: 'CHARACTER#TESS',
                    ephemeraId: 'MESSAGE#Test'
                }
            ], messageBus: messageBusMock })
            expect(messageBusMock.send).toHaveBeenCalledTimes(2)
            expect(messageBusMock.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                displayProtocol: 'WorldMessage',
                targets: ['CHARACTER#TESS'],
                message: [{
                    tag: 'String',
                    value: 'Test Message'
                }]
            })
        })

        it('should not render when character is not in a messaged room', async () => {
            cacheMock.Global.get.mockResolvedValue(['Base'])
            cacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#TESS',
                Name: 'Tess',
                assets: ['Personal'],
                RoomId: 'ROOM#VORTEX',
                HomeId: 'ROOM#VORTEX',
                Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
            })
            cacheMock.ComponentMeta.getAcrossAssets.mockResolvedValue({
                Base: {
                    EphemeraId: 'MESSAGE#Test',
                    assetId: 'Base',
                    appearances: [{
                        render: [{
                            tag: 'String',
                            value: 'Test Message'
                        }],
                        rooms: ['ROOM#ABC'],
                        conditions: []
                    }],
                    key: 'testMessage'
                }
            })
            await perceptionMessage({ payloads: [
                {
                    type: 'Perception',
                    characterId: 'CHARACTER#TESS',
                    ephemeraId: 'MESSAGE#Test'
                }
            ], messageBus: messageBusMock })
            expect(messageBusMock.send).toHaveBeenCalledTimes(1)
        })

        it('should not render when render tag delivers no contents', async () => {
            cacheMock.Global.get.mockResolvedValue(['Base'])
            cacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#TESS',
                Name: 'Tess',
                assets: ['Personal'],
                RoomId: 'ROOM#VORTEX',
                HomeId: 'ROOM#VORTEX',
                Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
            })
            cacheMock.ComponentMeta.getAcrossAssets.mockResolvedValue({
                Base: {
                    EphemeraId: 'MESSAGE#Test',
                    assetId: 'Base',
                    appearances: [{
                        render: [{
                            tag: 'String',
                            value: 'Test Message'
                        }],
                        rooms: ['ROOM#VORTEX', 'ROOM#ABC'],
                        conditions: []
                    }],
                    key: 'testMessage'
                }
            })
            cacheMock.ComponentRender.get.mockResolvedValue({
                Description: [],
                MessageId: 'MESSAGE#Test',
                rooms: ['ROOM#VORTEX', 'ROOM#ABC']
            })
            await perceptionMessage({ payloads: [
                {
                    type: 'Perception',
                    characterId: 'CHARACTER#TESS',
                    ephemeraId: 'MESSAGE#Test'
                }
            ], messageBus: messageBusMock })
            expect(messageBusMock.send).toHaveBeenCalledTimes(1)
        })

        it('should not render when room is not in evaluated conditions', async () => {
            cacheMock.Global.get.mockResolvedValue(['Base'])
            cacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#TESS',
                Name: 'Tess',
                assets: ['Personal'],
                RoomId: 'ROOM#VORTEX',
                HomeId: 'ROOM#VORTEX',
                Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
            })
            cacheMock.ComponentMeta.getAcrossAssets.mockResolvedValue({
                Base: {
                    EphemeraId: 'MESSAGE#Test',
                    assetId: 'Base',
                    appearances: [{
                        render: [{
                            tag: 'String',
                            value: 'Test Message'
                        }],
                        rooms: ['ROOM#VORTEX', 'ROOM#ABC'],
                        conditions: []
                    }],
                    key: 'testMessage'
                }
            })
            cacheMock.ComponentRender.get.mockResolvedValue({
                Description: [{
                    tag: 'String',
                    value: 'Test Message'
                }],
                MessageId: 'MESSAGE#Test',
                rooms: ['ROOM#ABC']
            })
            await perceptionMessage({ payloads: [
                {
                    type: 'Perception',
                    characterId: 'CHARACTER#TESS',
                    ephemeraId: 'MESSAGE#Test'
                }
            ], messageBus: messageBusMock })
            expect(messageBusMock.send).toHaveBeenCalledTimes(1)
        })
    })

})