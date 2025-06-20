import { 
    isSchemaShortName,
    isSchemaExit,
    isSchemaRoom, 
    isSchemaFeature, 
    isSchemaKnowledge, 
    isSchemaPosition, 
    isSchemaMap, 
    isSchemaMessage, 
    isSchemaMoment 
} from './components'

describe('components tags', () => {
    describe('isSchemaShortName', () => {
        it('should return true for valid SchemaShortNameTag', () => {
            const schema = { tag: 'ShortName' }
            expect(isSchemaShortName(schema)).toBe(true)
        })

        it('should return false for invalid SchemaShortNameTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaShortName(schema)).toBe(false)
        })
    })

    describe('isSchemaExit', () => {
        it('should return true for valid SchemaExitTag', () => {
            const schema = { tag: 'Exit', key: 'exitKey', to: 'destination', from: 'origin' }
            expect(isSchemaExit(schema)).toBe(true)
        })

        it('should return false for invalid SchemaExitTag', () => {
            const schema = { tag: 'Invalid', key: 'exitKey', to: 'destination', from: 'origin' }
            expect(isSchemaExit(schema)).toBe(false)
        })

        it('should return false for SchemaExitTag missing key', () => {
            const schema = { tag: 'Exit', to: 'destination', from: 'origin' }
            expect(isSchemaExit(schema)).toBe(false)
        })

        it('should return false for SchemaExitTag missing to', () => {
            const schema = { tag: 'Exit', key: 'exitKey', from: 'origin' }
            expect(isSchemaExit(schema)).toBe(false)
        })

        it('should return false for SchemaExitTag missing from', () => {
            const schema = { tag: 'Exit', key: 'exitKey', to: 'destination' }
            expect(isSchemaExit(schema)).toBe(false)
        })
    })

    describe('isSchemaRoom', () => {
        it('should return true for valid SchemaRoomTag', () => {
            const schema = { tag: 'Room', key: 'roomKey' }
            expect(isSchemaRoom(schema)).toBe(true)
        })

        it('should return false for invalid SchemaRoomTag', () => {
            const schema = { tag: 'Invalid', key: 'roomKey' }
            expect(isSchemaRoom(schema)).toBe(false)
        })

    })

    describe('isSchemaFeature', () => {
        it('should return true for valid SchemaFeatureTag', () => {
            const schema = { tag: 'Feature', key: 'featureKey' }
            expect(isSchemaFeature(schema)).toBe(true)
        })

        it('should return false for invalid SchemaFeatureTag', () => {
            const schema = { tag: 'Invalid', key: 'featureKey' }
            expect(isSchemaFeature(schema)).toBe(false)
        })

    })

    describe('isSchemaKnowledge', () => {
        it('should return true for valid SchemaKnowledgeTag', () => {
            const schema = { tag: 'Knowledge', key: 'knowledgeKey' }
            expect(isSchemaKnowledge(schema)).toBe(true)
        })

        it('should return false for invalid SchemaKnowledgeTag', () => {
            const schema = { tag: 'Invalid', key: 'knowledgeKey' }
            expect(isSchemaKnowledge(schema)).toBe(false)
        })

    })

    describe('isSchemaPosition', () => {
        it('should return true for valid SchemaPositionTag', () => {
            const schema = { tag: 'Position', x: 1, y: 2 }
            expect(isSchemaPosition(schema)).toBe(true)
        })

        it('should return false for invalid SchemaPositionTag', () => {
            const schema = { tag: 'Invalid', x: 1, y: 2 }
            expect(isSchemaPosition(schema)).toBe(false)
        })

        it('should return false for SchemaPositionTag missing coordinates', () => {
            const schema = { tag: 'Position' }
            expect(isSchemaPosition(schema)).toBe(false)
        })
    })

    describe('isSchemaMap', () => {
        it('should return true for valid SchemaMapTag', () => {
            const schema = { tag: 'Map', key: 'mapKey' }
            expect(isSchemaMap(schema)).toBe(true)
        })

        it('should return false for invalid SchemaMapTag', () => {
            const schema = { tag: 'Invalid', key: 'mapKey' }
            expect(isSchemaMap(schema)).toBe(false)
        })

    })

    describe('isSchemaMessage', () => {
        it('should return true for valid SchemaMessageTag', () => {
            const schema = { tag: 'Message', key: 'messageKey' }
            expect(isSchemaMessage(schema)).toBe(true)
        })

        it('should return false for invalid SchemaMessageTag', () => {
            const schema = { tag: 'Invalid', key: 'messageKey' }
            expect(isSchemaMessage(schema)).toBe(false)
        })

    })

    describe('isSchemaMoment', () => {
        it('should return true for valid SchemaMomentTag', () => {
            const schema = { tag: 'Moment', key: 'momentKey' }
            expect(isSchemaMoment(schema)).toBe(true)
        })

        it('should return false for invalid SchemaMomentTag', () => {
            const schema = { tag: 'Invalid', key: 'momentKey' }
            expect(isSchemaMoment(schema)).toBe(false)
        })

    })
})