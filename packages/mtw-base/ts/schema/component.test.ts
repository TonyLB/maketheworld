import { 
    isSchemaShortNameTag, 
    isSchemaRoomTag, 
    isSchemaFeatureTag, 
    isSchemaKnowledgeTag, 
    isSchemaPositionTag, 
    isSchemaMapTag, 
    isSchemaMessageTag, 
    isSchemaMomentTag 
} from './components'

describe('components tags', () => {
    describe('isSchemaShortNameTag', () => {
        it('should return true for valid SchemaShortNameTag', () => {
            const schema = { tag: 'ShortName' }
            expect(isSchemaShortNameTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaShortNameTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaShortNameTag(schema)).toBe(false)
        })
    })

    describe('isSchemaRoomTag', () => {
        it('should return true for valid SchemaRoomTag', () => {
            const schema = { tag: 'Room', key: 'roomKey' }
            expect(isSchemaRoomTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaRoomTag', () => {
            const schema = { tag: 'Invalid', key: 'roomKey' }
            expect(isSchemaRoomTag(schema)).toBe(false)
        })

        it('should return false for SchemaRoomTag missing key', () => {
            const schema = { tag: 'Room' }
            expect(isSchemaRoomTag(schema)).toBe(false)
        })
    })

    describe('isSchemaFeatureTag', () => {
        it('should return true for valid SchemaFeatureTag', () => {
            const schema = { tag: 'Feature', key: 'featureKey' }
            expect(isSchemaFeatureTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaFeatureTag', () => {
            const schema = { tag: 'Invalid', key: 'featureKey' }
            expect(isSchemaFeatureTag(schema)).toBe(false)
        })

        it('should return false for SchemaFeatureTag missing key', () => {
            const schema = { tag: 'Feature' }
            expect(isSchemaFeatureTag(schema)).toBe(false)
        })
    })

    describe('isSchemaKnowledgeTag', () => {
        it('should return true for valid SchemaKnowledgeTag', () => {
            const schema = { tag: 'Knowledge', key: 'knowledgeKey' }
            expect(isSchemaKnowledgeTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaKnowledgeTag', () => {
            const schema = { tag: 'Invalid', key: 'knowledgeKey' }
            expect(isSchemaKnowledgeTag(schema)).toBe(false)
        })

        it('should return false for SchemaKnowledgeTag missing key', () => {
            const schema = { tag: 'Knowledge' }
            expect(isSchemaKnowledgeTag(schema)).toBe(false)
        })
    })

    describe('isSchemaPositionTag', () => {
        it('should return true for valid SchemaPositionTag', () => {
            const schema = { tag: 'Position', x: 1, y: 2 }
            expect(isSchemaPositionTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaPositionTag', () => {
            const schema = { tag: 'Invalid', x: 1, y: 2 }
            expect(isSchemaPositionTag(schema)).toBe(false)
        })

        it('should return false for SchemaPositionTag missing coordinates', () => {
            const schema = { tag: 'Position' }
            expect(isSchemaPositionTag(schema)).toBe(false)
        })
    })

    describe('isSchemaMapTag', () => {
        it('should return true for valid SchemaMapTag', () => {
            const schema = { tag: 'Map', key: 'mapKey' }
            expect(isSchemaMapTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaMapTag', () => {
            const schema = { tag: 'Invalid', key: 'mapKey' }
            expect(isSchemaMapTag(schema)).toBe(false)
        })

        it('should return false for SchemaMapTag missing key', () => {
            const schema = { tag: 'Map' }
            expect(isSchemaMapTag(schema)).toBe(false)
        })
    })

    describe('isSchemaMessageTag', () => {
        it('should return true for valid SchemaMessageTag', () => {
            const schema = { tag: 'Message', key: 'messageKey' }
            expect(isSchemaMessageTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaMessageTag', () => {
            const schema = { tag: 'Invalid', key: 'messageKey' }
            expect(isSchemaMessageTag(schema)).toBe(false)
        })

        it('should return false for SchemaMessageTag missing key', () => {
            const schema = { tag: 'Message' }
            expect(isSchemaMessageTag(schema)).toBe(false)
        })
    })

    describe('isSchemaMomentTag', () => {
        it('should return true for valid SchemaMomentTag', () => {
            const schema = { tag: 'Moment', key: 'momentKey' }
            expect(isSchemaMomentTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaMomentTag', () => {
            const schema = { tag: 'Invalid', key: 'momentKey' }
            expect(isSchemaMomentTag(schema)).toBe(false)
        })

        it('should return false for SchemaMomentTag missing key', () => {
            const schema = { tag: 'Moment' }
            expect(isSchemaMomentTag(schema)).toBe(false)
        })
    })
})