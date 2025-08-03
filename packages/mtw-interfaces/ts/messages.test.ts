import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { isMessage, isPerceptionMessage, PerceptionMessage, WMLSchema } from './messages'

describe('PerceptionMessage', () => {
    const validPerceptionMessage: PerceptionMessage = {
        DisplayProtocol: 'PerceptionMessage',
        wmlContent: '<Room key=(mainHall)><ShortName>Main Hall</ShortName></Room>',
        componentUUID: 'ROOM#abc123',
        MessageId: 'msg123',
        CreatedTime: 1234567890,
        Target: 'CHARACTER#player1'
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

            const missingUUID: any = { ...validPerceptionMessage }
            delete missingUUID.componentUUID
            expect(isPerceptionMessage(missingUUID)).toBe(false)

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
            const invalidUUID = { ...validPerceptionMessage, componentUUID: 'invalid#uuid' }
            expect(isPerceptionMessage(invalidUUID)).toBe(false)

            const noHashUUID = { ...validPerceptionMessage, componentUUID: 'ROOMabc123' }
            expect(isPerceptionMessage(noHashUUID)).toBe(false)
        })

        it('should reject invalid Target format when present', () => {
            const invalidTarget = { ...validPerceptionMessage, Target: 'invalid#target' }
            expect(isPerceptionMessage(invalidTarget)).toBe(false)
        })

        it('should accept valid componentUUID formats', () => {
            const roomUUID = { ...validPerceptionMessage, componentUUID: 'ROOM#abc123' }
            expect(isPerceptionMessage(roomUUID)).toBe(true)

            const featureUUID = { ...validPerceptionMessage, componentUUID: 'FEATURE#def456' }
            expect(isPerceptionMessage(featureUUID)).toBe(true)

            const knowledgeUUID = { ...validPerceptionMessage, componentUUID: 'KNOWLEDGE#ghi789' }
            expect(isPerceptionMessage(knowledgeUUID)).toBe(true)

            const characterUUID = { ...validPerceptionMessage, componentUUID: 'CHARACTER#jkl012' }
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