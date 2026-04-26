import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import {
    isMessage,
    isPerceptionMessage,
    PerceptionMessage, 
    WMLSchema,
    PerceptionRoomMetaData,
    PerceptionFeatureMetaData,
    PerceptionKnowledgeMetaData,
    isPerceptionRoomMetaData,
    isPerceptionFeatureMetaData,
    isPerceptionKnowledgeMetaData,
    PerceptionMessageMetaData,
    DEFAULT_PERCEPTION_ROOM_CHANNEL,
    resolvedPerceptionRoomChannel
} from './messages'

describe('WorldOOCMessage', () => {
    it('should validate through isMessage with render tree Message', () => {
        expect(isMessage({
            DisplayProtocol: 'WorldOOCMessage',
            MessageId: 'MESSAGE#x',
            CreatedTime: 1,
            Message: ['Test']
        })).toBe(true)
    })

    it('should reject invalid Message payload', () => {
        expect(isMessage({
            DisplayProtocol: 'WorldOOCMessage',
            MessageId: 'MESSAGE#x',
            CreatedTime: 1,
            Message: 'not a render tree'
        })).toBe(false)
    })
})

describe('CoyoteGameHypothesisMessage', () => {
    it('should validate through isMessage with render tree Message', () => {
        expect(isMessage({
            DisplayProtocol: 'CoyoteGameHypothesisMessage',
            MessageId: 'MESSAGE#h1',
            CreatedTime: 1,
            Message: ['Hypothesis: Generating...']
        })).toBe(true)
    })

    it('should reject invalid Message payload', () => {
        expect(isMessage({
            DisplayProtocol: 'CoyoteGameHypothesisMessage',
            MessageId: 'MESSAGE#h1',
            CreatedTime: 1,
            Message: 'not a render tree'
        })).toBe(false)
    })

    it('should validate with optional character Target', () => {
        expect(isMessage({
            DisplayProtocol: 'CoyoteGameHypothesisMessage',
            MessageId: 'MESSAGE#h1',
            CreatedTime: 1,
            Target: 'CHARACTER#x',
            Message: ['Test']
        })).toBe(true)
    })

    it('should reject with malformed target', () => {
        expect(isMessage({
            DisplayProtocol: 'CoyoteGameHypothesisMessage',
            MessageId: 'MESSAGE#h1',
            CreatedTime: 1,
            Target: 'TARGET#bad',
            Message: ['Test']
        })).toBe(false)
    })
})

describe('CoyoteGameHelpMessage', () => {
    it('should validate through isMessage with addressing fields only', () => {
        expect(isMessage({
            DisplayProtocol: 'CoyoteGameHelpMessage',
            MessageId: 'MESSAGE#help',
            CreatedTime: 1,
            Target: 'CHARACTER#x'
        })).toBe(true)
    })

    it('should reject if required addressing fields are missing', () => {
        expect(isMessage({
            DisplayProtocol: 'CoyoteGameHelpMessage',
            CreatedTime: 1
        })).toBe(false)
    })

    it('should validate CoyoteGameHelpMessage with session target', () => {
        expect(isMessage({
            DisplayProtocol: 'CoyoteGameHelpMessage',
            MessageId: 'MESSAGE#help-session',
            CreatedTime: 1,
            Target: 'SESSION#anon'
        })).toBe(true)
    })

    it('should reject CoyoteGameHelpMessage with malformed target', () => {
        expect(isMessage({
            DisplayProtocol: 'CoyoteGameHelpMessage',
            MessageId: 'MESSAGE#help-bad-target',
            CreatedTime: 1,
            Target: 'TARGET#bad'
        })).toBe(false)
    })
})

describe('PerceptionMessage', () => {
    const validPerceptionMessage: PerceptionMessage = {
        DisplayProtocol: 'PerceptionMessage',
        wmlContent: '<Room key=(mainHall)><ShortName>Main Hall</ShortName></Room>',
        MessageId: 'msg123',
        CreatedTime: 1234567890,
        Target: 'CHARACTER#player1',
        metaData: {
            componentUUID: 'ROOM#abc123',
            displayMode: 'full'
        }
    }

    describe('isPerceptionMessage', () => {
        it('should validate a correct PerceptionMessage', () => {
            expect(isPerceptionMessage(validPerceptionMessage)).toBe(true)
        })

        it('should reject non-objects', () => {
            expect(isPerceptionMessage('not an object')).toBe(false)
            expect(isPerceptionMessage(null)).toBe(false)
            expect(isPerceptionMessage(undefined)).toBe(false)
        })

        it('should reject messages with wrong DisplayProtocol', () => {
            const invalidMessage = { ...validPerceptionMessage, DisplayProtocol: 'WorldMessage' }
            expect(isPerceptionMessage(invalidMessage)).toBe(false)
        })

        it('should reject messages with missing required fields', () => {
            const missingWML: any = { ...validPerceptionMessage }
            delete missingWML.wmlContent
            expect(isPerceptionMessage(missingWML)).toBe(false)

            const missingMetaData: any = { ...validPerceptionMessage }
            delete missingMetaData.metaData
            expect(isPerceptionMessage(missingMetaData)).toBe(false)

            const missingMessageId: any = { ...validPerceptionMessage }
            delete missingMessageId.MessageId
            expect(isPerceptionMessage(missingMessageId)).toBe(false)

            const missingCreatedTime: any = { ...validPerceptionMessage }
            delete missingCreatedTime.CreatedTime
            expect(isPerceptionMessage(missingCreatedTime)).toBe(false)
        })

        it('should reject empty wmlContent', () => {
            const emptyWML = { ...validPerceptionMessage, wmlContent: '' }
            expect(isPerceptionMessage(emptyWML)).toBe(false)
        })

        it('should reject invalid componentUUID format', () => {
            const invalidUUID = { ...validPerceptionMessage, metaData: { ...validPerceptionMessage.metaData, componentUUID: 'invalid#uuid' as any } }
            expect(isPerceptionMessage(invalidUUID)).toBe(false)

            const noHashUUID = { ...validPerceptionMessage, metaData: { ...validPerceptionMessage.metaData, componentUUID: 'ROOMabc123' as any } }
            expect(isPerceptionMessage(noHashUUID)).toBe(false)
        })

        it('should reject invalid Target format when present', () => {
            const invalidTarget = { ...validPerceptionMessage, Target: 'invalid#target' }
            expect(isPerceptionMessage(invalidTarget)).toBe(false)
        })

        it('should accept valid character-based Target format', () => {
            const characterTarget = { ...validPerceptionMessage, Target: 'CHARACTER#player1' }
            expect(isPerceptionMessage(characterTarget)).toBe(true)

            const characterTarget2 = { ...validPerceptionMessage, Target: 'CHARACTER#guest123' }
            expect(isPerceptionMessage(characterTarget2)).toBe(true)
        })

        it('should accept valid session-based Target format', () => {
            const sessionTarget = { ...validPerceptionMessage, Target: 'SESSION#anonymous' }
            expect(isPerceptionMessage(sessionTarget)).toBe(true)

            const sessionTarget2 = { ...validPerceptionMessage, Target: 'SESSION#abc123def' }
            expect(isPerceptionMessage(sessionTarget2)).toBe(true)

            const sessionTarget3 = { ...validPerceptionMessage, Target: 'SESSION#test-session-id' }
            expect(isPerceptionMessage(sessionTarget3)).toBe(true)
        })

        it('should reject invalid session-based Target format', () => {
            const invalidSessionTarget = { ...validPerceptionMessage, Target: 'SESSION#' }
            expect(isPerceptionMessage(invalidSessionTarget)).toBe(false)

            const invalidSessionTarget2 = { ...validPerceptionMessage, Target: 'SESSION' }
            expect(isPerceptionMessage(invalidSessionTarget2)).toBe(false)
        })

        it('should accept valid componentUUID formats', () => {
            const roomUUID = { ...validPerceptionMessage, metaData: { ...validPerceptionMessage.metaData, componentUUID: 'ROOM#abc123' } }
            expect(isPerceptionMessage(roomUUID)).toBe(true)

            const featureUUID = { ...validPerceptionMessage, metaData: { ...validPerceptionMessage.metaData, componentUUID: 'FEATURE#def456' } }
            expect(isPerceptionMessage(featureUUID)).toBe(true)

            const knowledgeUUID = { ...validPerceptionMessage, metaData: { ...validPerceptionMessage.metaData, componentUUID: 'KNOWLEDGE#ghi789' } }
            expect(isPerceptionMessage(knowledgeUUID)).toBe(true)

            const characterUUID = { ...validPerceptionMessage, metaData: { ...validPerceptionMessage.metaData, componentUUID: 'CHARACTER#jkl012' } }
            expect(isPerceptionMessage(characterUUID)).toBe(true)
        })

        it('should accept messages without Target', () => {
            const noTarget = { ...validPerceptionMessage }
            delete noTarget.Target
            expect(isPerceptionMessage(noTarget)).toBe(true)
        })
    })

    describe('isMessage with PerceptionMessage', () => {
        it('should validate PerceptionMessage through isMessage', () => {
            expect(isMessage(validPerceptionMessage)).toBe(true)
        })

        it('should reject invalid PerceptionMessage through isMessage', () => {
            const invalidMessage = { ...validPerceptionMessage, wmlContent: '' }
            expect(isMessage(invalidMessage)).toBe(false)
        })

        it('should validate PerceptionMessage with session-based Target through isMessage', () => {
            const sessionTargetMessage = { ...validPerceptionMessage, Target: 'SESSION#anonymous' }
            expect(isMessage(sessionTargetMessage)).toBe(true)
        })

        it('should validate PerceptionMessage with character-based Target through isMessage', () => {
            const characterTargetMessage = { ...validPerceptionMessage, Target: 'CHARACTER#player1' }
            expect(isMessage(characterTargetMessage)).toBe(true)
        })

        it('should reject PerceptionMessage with invalid Target through isMessage', () => {
            const invalidTargetMessage = { ...validPerceptionMessage, Target: 'INVALID#target' }
            expect(isMessage(invalidTargetMessage)).toBe(false)
        })
    })

    describe('Type definitions', () => {
        it('should allow WMLSchema to be a string', () => {
            const wmlContent: WMLSchema = '<Room key=(test)><ShortName>Test</ShortName></Room>'
            expect(typeof wmlContent).toBe('string')
        })

        it('should allow SchemaComponentUUID to be a valid EphemeraId', () => {
            const componentUUID: ComponentUUID = 'ROOM#test123'
            expect(typeof componentUUID).toBe('string')
            expect(componentUUID.includes('#')).toBe(true)
        })
    })
})

describe('PerceptionMessage MetaData System', () => {
    describe('PerceptionRoomMetaData', () => {
        const roomMetaData: PerceptionRoomMetaData = {
            componentUUID: 'ROOM#mainHall',
            displayMode: 'header'
        }

        it('should accept valid room metadata with header displayMode', () => {
            expect(roomMetaData.componentUUID).toBe('ROOM#mainHall')
            expect(roomMetaData.displayMode).toBe('header')
            expect(roomMetaData.status).toBeUndefined()
        })

        it('should accept valid room metadata with full displayMode', () => {
            const fullRoomMetaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#testRoom',
                displayMode: 'full'
            }
            expect(fullRoomMetaData.displayMode).toBe('full')
            expect(fullRoomMetaData.status).toBeUndefined()
        })

        it('should allow status to be set to ready or generating', () => {
            const readyMetaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#readyRoom',
                displayMode: 'header',
                status: 'ready'
            }
            const generatingMetaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#generatingRoom',
                displayMode: 'header',
                status: 'generating'
            }
            expect(readyMetaData.status).toBe('ready')
            expect(generatingMetaData.status).toBe('generating')
        })

        it('should be identified by type guard', () => {
            expect(isPerceptionRoomMetaData(roomMetaData)).toBe(true)
        })

        it('should provide type safety for displayMode', () => {
            // This test verifies TypeScript compilation - the type system ensures
            // only 'header' | 'full' are valid values for displayMode
            const validModes: Array<PerceptionRoomMetaData['displayMode']> = ['header', 'full']
            expect(validModes).toContain('header')
            expect(validModes).toContain('full')
        })

        it('should accept roomChannel render or affordances', () => {
            const renderRow: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#ch1',
                displayMode: 'header',
                roomChannel: 'render'
            }
            const affordRow: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#ch1',
                displayMode: 'header',
                roomChannel: 'affordances'
            }
            expect(renderRow.roomChannel).toBe('render')
            expect(affordRow.roomChannel).toBe('affordances')
        })

        it('should treat omitted roomChannel as render via resolvedPerceptionRoomChannel', () => {
            const legacy: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#legacy',
                displayMode: 'full'
            }
            expect(resolvedPerceptionRoomChannel(legacy)).toBe(DEFAULT_PERCEPTION_ROOM_CHANNEL)
        })
    })

    describe('PerceptionFeatureMetaData', () => {
        const featureMetaData: PerceptionFeatureMetaData = {
            componentUUID: 'FEATURE#treasureChest'
        }

        it('should accept valid feature metadata', () => {
            expect(featureMetaData.componentUUID).toBe('FEATURE#treasureChest')
        })

        it('should be identified by type guard', () => {
            expect(isPerceptionFeatureMetaData(featureMetaData)).toBe(true)
        })

        it('should not have displayMode property', () => {
            // TypeScript compilation verifies that displayMode doesn't exist on FeatureMetaData
            expect('displayMode' in featureMetaData).toBe(false)
        })
    })

    describe('PerceptionKnowledgeMetaData', () => {
        const knowledgeMetaData: PerceptionKnowledgeMetaData = {
            componentUUID: 'KNOWLEDGE#ancientHistory'
        }

        it('should accept valid knowledge metadata', () => {
            expect(knowledgeMetaData.componentUUID).toBe('KNOWLEDGE#ancientHistory')
        })

        it('should be identified by type guard', () => {
            expect(isPerceptionKnowledgeMetaData(knowledgeMetaData)).toBe(true)
        })
    })

    describe('Type Guard Functions', () => {
        const roomMetaData: PerceptionMessageMetaData = {
            componentUUID: 'ROOM#test',
            displayMode: 'header'
        }

        const featureMetaData: PerceptionMessageMetaData = {
            componentUUID: 'FEATURE#test'
        }

        const knowledgeMetaData: PerceptionMessageMetaData = {
            componentUUID: 'KNOWLEDGE#test'
        }

        describe('isPerceptionRoomMetaData', () => {
            it('should correctly identify room metadata', () => {
                expect(isPerceptionRoomMetaData(roomMetaData)).toBe(true)
                expect(isPerceptionRoomMetaData(featureMetaData)).toBe(false)
                expect(isPerceptionRoomMetaData(knowledgeMetaData)).toBe(false)
            })

            it('should provide type narrowing', () => {
                if (isPerceptionRoomMetaData(roomMetaData)) {
                    // TypeScript should know that roomMetaData has displayMode property
                    expect(roomMetaData.displayMode).toBeDefined()
                    expect(['header', 'full']).toContain(roomMetaData.displayMode)
                }
            })
        })

        describe('isPerceptionFeatureMetaData', () => {
            it('should correctly identify feature metadata', () => {
                expect(isPerceptionFeatureMetaData(roomMetaData)).toBe(false)
                expect(isPerceptionFeatureMetaData(featureMetaData)).toBe(true)
                expect(isPerceptionFeatureMetaData(knowledgeMetaData)).toBe(false)
            })
        })

        describe('isPerceptionKnowledgeMetaData', () => {
            it('should correctly identify knowledge metadata', () => {
                expect(isPerceptionKnowledgeMetaData(roomMetaData)).toBe(false)
                expect(isPerceptionKnowledgeMetaData(featureMetaData)).toBe(false)
                expect(isPerceptionKnowledgeMetaData(knowledgeMetaData)).toBe(true)
            })
        })
    })

    describe('PerceptionMessage with MetaData', () => {
        const roomHeaderMessage: PerceptionMessage = {
            DisplayProtocol: 'PerceptionMessage',
            wmlContent: '<Room key=(mainHall)><ShortName>Main Hall</ShortName></Room>',
            metaData: {
                componentUUID: 'ROOM#mainHall',
                displayMode: 'header'
            },
            MessageId: 'msg123',
            CreatedTime: 1234567890
        }

        const roomFullMessage: PerceptionMessage = {
            DisplayProtocol: 'PerceptionMessage',
            wmlContent: '<Room key=(mainHall)><ShortName>Main Hall</ShortName><Description>A grand hall</Description></Room>',
            metaData: {
                componentUUID: 'ROOM#mainHall',
                displayMode: 'full'
            },
            MessageId: 'msg124',
            CreatedTime: 1234567891
        }

        const featureMessage: PerceptionMessage = {
            DisplayProtocol: 'PerceptionMessage',
            wmlContent: '<Feature key=(chest)><ShortName>Treasure Chest</ShortName></Feature>',
            metaData: {
                componentUUID: 'FEATURE#chest'
            },
            MessageId: 'msg125',
            CreatedTime: 1234567892
        }

        it('should validate room header message with metaData', () => {
            expect(isPerceptionMessage(roomHeaderMessage)).toBe(true)
            expect(isMessage(roomHeaderMessage)).toBe(true)
            
            if (roomHeaderMessage.metaData && isPerceptionRoomMetaData(roomHeaderMessage.metaData)) {
                expect(roomHeaderMessage.metaData.displayMode).toBe('header')
            } else {
                fail('Room header message should have valid room metadata')
            }
        })

        it('should validate room full message with metaData', () => {
            expect(isPerceptionMessage(roomFullMessage)).toBe(true)
            expect(isMessage(roomFullMessage)).toBe(true)
            
            if (roomFullMessage.metaData && isPerceptionRoomMetaData(roomFullMessage.metaData)) {
                expect(roomFullMessage.metaData.displayMode).toBe('full')
            } else {
                fail('Room full message should have valid room metadata')
            }
        })

        it('should validate feature message with metaData', () => {
            expect(isPerceptionMessage(featureMessage)).toBe(true)
            expect(isMessage(featureMessage)).toBe(true)
            
            if (featureMessage.metaData && isPerceptionFeatureMetaData(featureMessage.metaData)) {
                expect(featureMessage.metaData.componentUUID).toBe('FEATURE#chest')
                // TypeScript ensures displayMode doesn't exist on FeatureMetaData
            } else {
                fail('Feature message should have valid feature metadata')
            }
        })

        it('should handle messages with metaData', () => {
            const messageWithMetaData: PerceptionMessage = {
                DisplayProtocol: 'PerceptionMessage',
                wmlContent: '<Room key=(test)><ShortName>Test</ShortName></Room>',
                MessageId: 'msg126',
                CreatedTime: 1234567893,
                metaData: {
                    componentUUID: 'ROOM#test',
                    displayMode: 'full'
                }
            }

            expect(isPerceptionMessage(messageWithMetaData)).toBe(true)
            expect(isMessage(messageWithMetaData)).toBe(true)
            expect(messageWithMetaData.metaData).toBeDefined()
            expect(messageWithMetaData.metaData.componentUUID).toBe('ROOM#test')
        })
    })

    describe('Message Routing Scenario', () => {
        it('should correctly route messages based on metaData', () => {
            const messages: PerceptionMessage[] = [
                {
                    DisplayProtocol: 'PerceptionMessage',
                    wmlContent: '<Room key=(hall)><ShortName>Hall</ShortName></Room>',
                    metaData: {
                        componentUUID: 'ROOM#hall',
                        displayMode: 'header'
                    },
                    MessageId: 'msg1',
                    CreatedTime: 1000
                },
                {
                    DisplayProtocol: 'PerceptionMessage',
                    wmlContent: '<Room key=(hall)><ShortName>Hall</ShortName><Description>Full description</Description></Room>',
                    metaData: {
                        componentUUID: 'ROOM#hall',
                        displayMode: 'full'
                    },
                    MessageId: 'msg2',
                    CreatedTime: 1001
                },
                {
                    DisplayProtocol: 'PerceptionMessage',
                    wmlContent: '<Feature key=(door)><ShortName>Door</ShortName></Feature>',
                    metaData: {
                        componentUUID: 'FEATURE#door'
                    },
                    MessageId: 'msg3',
                    CreatedTime: 1002
                }
            ]

            // Simulate message routing logic
            const routingResults = messages.map(message => {
                const metaData = message.metaData
                
                if (metaData && isPerceptionRoomMetaData(metaData)) {
                    return {
                        type: 'RoomDescription',
                        isHeader: metaData.displayMode === 'header',
                        componentUUID: metaData.componentUUID
                    }
                }
                
                if (metaData && isPerceptionFeatureMetaData(metaData)) {
                    return {
                        type: 'ComponentDescription',
                        subtype: 'Feature',
                        componentUUID: metaData.componentUUID
                    }
                }
                
                // Fallback for unknown metadata
                return {
                    type: 'Unknown',
                    componentUUID: metaData?.componentUUID || 'UNKNOWN'
                }
            })

            expect(routingResults).toEqual([
                {
                    type: 'RoomDescription',
                    isHeader: true,
                    componentUUID: 'ROOM#hall'
                },
                {
                    type: 'RoomDescription',
                    isHeader: false,
                    componentUUID: 'ROOM#hall'
                },
                {
                    type: 'ComponentDescription',
                    subtype: 'Feature',
                    componentUUID: 'FEATURE#door'
                }
            ])
        })
    })
}) 