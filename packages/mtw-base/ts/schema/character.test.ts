import { isSchemaPronounsTag, isSchemaFirstImpressionTag, isSchemaOneCoolThingTag, isSchemaOutfitTag, isSchemaCharacterTag } from './character'

describe('character tags', () => {
    describe('isSchemaPronounsTag', () => {
        it('should return true for valid SchemaPronounsTag', () => {
            const schema = { tag: 'Pronouns', subject: 'he', object: 'him', possessive: 'his', adjective: 'his', reflexive: 'himself' }
            expect(isSchemaPronounsTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaPronounsTag', () => {
            const schema = { tag: 'Invalid', subject: 'he', object: 'him', possessive: 'his', adjective: 'his', reflexive: 'himself' }
            expect(isSchemaPronounsTag(schema)).toBe(false)
        })
    })

    describe('isSchemaFirstImpressionTag', () => {
        it('should return true for valid SchemaFirstImpressionTag', () => {
            const schema = { tag: 'FirstImpression', value: 'Friendly' }
            expect(isSchemaFirstImpressionTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaFirstImpressionTag', () => {
            const schema = { tag: 'Invalid', value: 'Friendly' }
            expect(isSchemaFirstImpressionTag(schema)).toBe(false)
        })
    })

    describe('isSchemaOneCoolThingTag', () => {
        it('should return true for valid SchemaOneCoolThingTag', () => {
            const schema = { tag: 'OneCoolThing', value: 'Can juggle' }
            expect(isSchemaOneCoolThingTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaOneCoolThingTag', () => {
            const schema = { tag: 'Invalid', value: 'Can juggle' }
            expect(isSchemaOneCoolThingTag(schema)).toBe(false)
        })
    })

    describe('isSchemaOutfitTag', () => {
        it('should return true for valid SchemaOutfitTag', () => {
            const schema = { tag: 'Outfit', value: 'Casual' }
            expect(isSchemaOutfitTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaOutfitTag', () => {
            const schema = { tag: 'Invalid', value: 'Casual' }
            expect(isSchemaOutfitTag(schema)).toBe(false)
        })
    })

    describe('isSchemaCharacterTag', () => {
        it('should return true for valid SchemaCharacterTag', () => {
            const schema = { tag: 'Character', key: 'char1', Pronouns: { subject: 'he', object: 'him', possessive: 'his', adjective: 'his', reflexive: 'himself' } }
            expect(isSchemaCharacterTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaCharacterTag', () => {
            const schema = { tag: 'Invalid', key: 'char1', Pronouns: { subject: 'he', object: 'him', possessive: 'his', adjective: 'his', reflexive: 'himself' } }
            expect(isSchemaCharacterTag(schema)).toBe(false)
        })

        it('should return false for SchemaCharacterTag missing key', () => {
            const schema = { tag: 'Character', Pronouns: { subject: 'he', object: 'him', possessive: 'his', adjective: 'his', reflexive: 'himself' } }
            expect(isSchemaCharacterTag(schema)).toBe(false)
        })
    })
})