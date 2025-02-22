import { isSchemaPronouns, isSchemaOneCoolThing, isSchemaCharacter } from './character'

describe('character tags', () => {
    describe('isSchemaPronouns', () => {
        it('should return true for valid SchemaPronounsTag', () => {
            const schema = { tag: 'Pronouns', subject: 'he', object: 'him', possessive: 'his', adjective: 'his', reflexive: 'himself' }
            expect(isSchemaPronouns(schema)).toBe(true)
        })

        it('should return false for invalid SchemaPronounsTag', () => {
            const schema = { tag: 'Invalid', subject: 'he', object: 'him', possessive: 'his', adjective: 'his', reflexive: 'himself' }
            expect(isSchemaPronouns(schema)).toBe(false)
        })
    })

    describe('isSchemaOneCoolThing', () => {
        it('should return true for valid SchemaOneCoolThingTag', () => {
            const schema = { tag: 'OneCoolThing', value: 'Can juggle' }
            expect(isSchemaOneCoolThing(schema)).toBe(true)
        })

        it('should return false for invalid SchemaOneCoolThingTag', () => {
            const schema = { tag: 'Invalid', value: 'Can juggle' }
            expect(isSchemaOneCoolThing(schema)).toBe(false)
        })
    })

    describe('isSchemaCharacter', () => {
        it('should return true for valid SchemaCharacterTag', () => {
            const schema = { tag: 'Character', key: 'char1', Pronouns: { subject: 'he', object: 'him', possessive: 'his', adjective: 'his', reflexive: 'himself' } }
            expect(isSchemaCharacter(schema)).toBe(true)
        })

        it('should return false for invalid SchemaCharacterTag', () => {
            const schema = { tag: 'Invalid', key: 'char1', Pronouns: { subject: 'he', object: 'him', possessive: 'his', adjective: 'his', reflexive: 'himself' } }
            expect(isSchemaCharacter(schema)).toBe(false)
        })

        it('should return false for SchemaCharacterTag missing key', () => {
            const schema = { tag: 'Character', Pronouns: { subject: 'he', object: 'him', possessive: 'his', adjective: 'his', reflexive: 'himself' } }
            expect(isSchemaCharacter(schema)).toBe(false)
        })
    })
})