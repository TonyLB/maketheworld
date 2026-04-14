import { 
    isSchemaShortName,
    isSchemaExit,
    isSchemaRoom, 
    isSchemaFeature, 
    isSchemaKnowledge, 
    isSchemaPosition, 
    isSchemaMap, 
    isSchemaMessage, 
    isSchemaMoment,
    isSchemaSituation,
    isSchemaRender
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
            const schema = { tag: 'Exit', to: 'destination' }
            expect(isSchemaExit(schema)).toBe(true)
        })

        it('should return false for invalid SchemaExitTag', () => {
            const schema = { tag: 'Invalid', to: 'destination' }
            expect(isSchemaExit(schema)).toBe(false)
        })

        it('should return false for SchemaExitTag missing to', () => {
            const schema = { tag: 'Exit' }
            expect(isSchemaExit(schema)).toBe(false)
        })
    })

    describe('isSchemaRoom', () => {
        it('should return true for valid SchemaRoomTag', () => {
            const schema = { tag: 'Room', key: 'roomKey' }
            expect(isSchemaRoom(schema)).toBe(true)
        })

        it('should return true for valid SchemaRoomTag with origin', () => {
            const schema = { tag: 'Room', key: 'roomKey', origin: ['ASSET#123', 'ASSET#456'] }
            expect(isSchemaRoom(schema)).toBe(true)
        })

        it('should return true for valid SchemaRoomTag with empty origin array', () => {
            const schema = { tag: 'Room', key: 'roomKey', origin: [] }
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

        it('should return true for valid SchemaFeatureTag with origin', () => {
            const schema = { tag: 'Feature', key: 'featureKey', origin: ['ASSET#123', 'ASSET#456'] }
            expect(isSchemaFeature(schema)).toBe(true)
        })

        it('should return true for valid SchemaFeatureTag with empty origin array', () => {
            const schema = { tag: 'Feature', key: 'featureKey', origin: [] }
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

        it('should return true for valid SchemaKnowledgeTag with origin', () => {
            const schema = { tag: 'Knowledge', key: 'knowledgeKey', origin: ['ASSET#123', 'ASSET#456'] }
            expect(isSchemaKnowledge(schema)).toBe(true)
        })

        it('should return true for valid SchemaKnowledgeTag with empty origin array', () => {
            const schema = { tag: 'Knowledge', key: 'knowledgeKey', origin: [] }
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

        it('should return true for valid SchemaMapTag with origin', () => {
            const schema = { tag: 'Map', key: 'mapKey', origin: ['ASSET#123', 'ASSET#456'] }
            expect(isSchemaMap(schema)).toBe(true)
        })

        it('should return true for valid SchemaMapTag with empty origin array', () => {
            const schema = { tag: 'Map', key: 'mapKey', origin: [] }
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

        it('should return true for valid SchemaMessageTag with origin', () => {
            const schema = { tag: 'Message', key: 'messageKey', origin: ['ASSET#123', 'ASSET#456'] }
            expect(isSchemaMessage(schema)).toBe(true)
        })

        it('should return true for valid SchemaMessageTag with empty origin array', () => {
            const schema = { tag: 'Message', key: 'messageKey', origin: [] }
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

        it('should return true for valid SchemaMomentTag with origin', () => {
            const schema = { tag: 'Moment', key: 'momentKey', origin: ['ASSET#123', 'ASSET#456'] }
            expect(isSchemaMoment(schema)).toBe(true)
        })

        it('should return true for valid SchemaMomentTag with empty origin array', () => {
            const schema = { tag: 'Moment', key: 'momentKey', origin: [] }
            expect(isSchemaMoment(schema)).toBe(true)
        })

        it('should return false for invalid SchemaMomentTag', () => {
            const schema = { tag: 'Invalid', key: 'momentKey' }
            expect(isSchemaMoment(schema)).toBe(false)
        })

    })

    describe('isSchemaSituation', () => {
        it('should return true for valid SchemaSituationTag', () => {
            const schema = { tag: 'Situation', key: 'situationKey' }
            expect(isSchemaSituation(schema)).toBe(true)
        })

        it('should return true for valid SchemaSituationTag with optional props', () => {
            const schema = { tag: 'Situation', key: 'situationKey', uuid: 'SITUATION#abc', ref: 0 }
            expect(isSchemaSituation(schema)).toBe(true)
        })

        it('should return true for valid SchemaSituationTag with origin', () => {
            const schema = { tag: 'Situation', key: 'situationKey', origin: ['ASSET#123', 'ASSET#456'] }
            expect(isSchemaSituation(schema)).toBe(true)
        })

        it('should return true for valid SchemaSituationTag with empty origin array', () => {
            const schema = { tag: 'Situation', key: 'situationKey', origin: [] }
            expect(isSchemaSituation(schema)).toBe(true)
        })

        it('should return false for invalid SchemaSituationTag', () => {
            const schema = { tag: 'Invalid', key: 'situationKey' }
            expect(isSchemaSituation(schema)).toBe(false)
        })

        it('should return false for wrong tag', () => {
            const schema = { tag: 'Guidance', key: 'key' }
            expect(isSchemaSituation(schema)).toBe(false)
        })
    })

    describe('isSchemaRender', () => {
        it('should return true for valid SchemaRenderTag', () => {
            const schema = { tag: 'Render' }
            expect(isSchemaRender(schema)).toBe(true)
        })

        it('should return false for invalid tag', () => {
            const schema = { tag: 'Object' }
            expect(isSchemaRender(schema)).toBe(false)
        })

        it('should return false when tag is missing', () => {
            const schema = {}
            expect(isSchemaRender(schema)).toBe(false)
        })
    })
})