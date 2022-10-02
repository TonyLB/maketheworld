jest.mock('../internalCache')
import internalCache from "../internalCache"
jest.mock('../messageBus')
import messageBus from '../messageBus'

import perceptionMessage from '.'

const cacheMock = jest.mocked(internalCache, true)
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>

describe('Perception message', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should render only appearances whose condition succeeds', async () => {
        cacheMock.Global.get.mockResolvedValue(['Base'])
        cacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: ['Personal'],
            RoomId: 'VORTEX',
            HomeId: 'VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        cacheMock.ComponentMeta.getAcrossAssets.mockResolvedValue({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                tag: 'Room',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [{ if: 'testOne', dependencies: [] }],
                        name: 'TestRoom',
                        render: [{ tag: 'String', value: 'First' }],
                        exits: []
                    },
                    {
                        conditions: [{ if: 'testTwo', dependencies: [] }],
                        name: '',
                        render: [{ tag: 'String', value: 'ERROR' }],
                        exits: []
                    }
                ]
            },
            Personal: {
                EphemeraId: 'ROOM#TestOne',
                tag: 'Room',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [{ if: 'testThree', dependencies: [] }],
                        name: 'ERROR',
                        render: [{ tag: 'String', value: 'ERROR' }],
                        exits: []
                    },
                    {
                        conditions: [{ if: 'testFour', dependencies: [] }],
                        name: '',
                        render: [{ tag: 'String', value: 'Second' }],
                        exits: []
                    }
                ]
            }
        })
        cacheMock.EvaluateCode.get.mockImplementation(async ({ source }) => {
            return Boolean(['testOne', 'testFour'].includes(source))
        })
        cacheMock.RoomCharacterList.get.mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', ConnectionIds: [] }
        ])
        await perceptionMessage({ payloads: [
            {
                type: 'Perception',
                characterId: 'CHARACTER#TESS',
                ephemeraId: 'ROOM#TestOne'
            }
        ], messageBus: messageBusMock })
        expect(cacheMock.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith('ROOM#TestOne', ['Base', 'Personal'])
        expect(messageBusMock.send).toHaveBeenCalledTimes(2)
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'PublishMessage',
            displayProtocol: 'RoomDescription',
            targets: [{ characterId: 'CHARACTER#TESS' }],
            RoomId: 'TestOne',
            Name: 'TestRoom',
            Characters: [{ CharacterId: 'TESS', Name: 'Tess', Color: 'purple' }],
            Description: [{ tag: 'String', value: 'FirstSecond' }],
            Exits: []
        })
    })

    it('should render only features correctly', async () => {
        cacheMock.Global.get.mockResolvedValue(['Base'])
        cacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: ['Personal'],
            RoomId: 'VORTEX',
            HomeId: 'VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        cacheMock.ComponentMeta.getAcrossAssets.mockResolvedValue({
            Base: {
                EphemeraId: 'FEATURE#TestOne',
                tag: 'Feature',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [{ if: 'testOne', dependencies: [] }],
                        name: 'TestFeature',
                        render: [{ tag: 'String', value: 'First' }],
                    },
                    {
                        conditions: [{ if: 'testTwo', dependencies: [] }],
                        name: '',
                        render: [{ tag: 'String', value: 'ERROR' }],
                    }
                ]
            },
            Personal: {
                EphemeraId: 'FEATURE#TestOne',
                tag: 'Feature',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [{ if: 'testThree', dependencies: [] }],
                        name: 'ERROR',
                        render: [{ tag: 'String', value: 'ERROR' }],
                    },
                    {
                        conditions: [{ if: 'testFour', dependencies: [] }],
                        name: '',
                        render: [{ tag: 'String', value: 'Second' }],
                    }
                ]
            }
        })
        cacheMock.EvaluateCode.get.mockImplementation(async ({ source }) => {
            return Boolean(['testOne', 'testFour'].includes(source))
        })
        cacheMock.RoomCharacterList.get.mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', ConnectionIds: [] }
        ])
        await perceptionMessage({ payloads: [
            {
                type: 'Perception',
                characterId: 'CHARACTER#TESS',
                ephemeraId: 'FEATURE#TestOne'
            }
        ], messageBus: messageBusMock })
        expect(cacheMock.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith('FEATURE#TestOne', ['Base', 'Personal'])
        expect(messageBusMock.send).toHaveBeenCalledTimes(2)
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'PublishMessage',
            displayProtocol: 'FeatureDescription',
            targets: [{ characterId: 'CHARACTER#TESS' }],
            FeatureId: 'TestOne',
            Name: 'TestFeature',
            Description: [{ tag: 'String', value: 'FirstSecond' }],
        })
    })
})