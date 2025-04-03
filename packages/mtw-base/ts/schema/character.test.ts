import { isSchemaPronouns, isSchemaCharacter } from './character'

describe('character tags', () => {
    describe('isSchemaPronouns', () => {
        it('should return true for valid SchemaPronounsTag', () => {
            const schema = { tag: 'Pronouns' }
            expect(isSchemaPronouns(schema)).toBe(true)
        })

        it('should return false for invalid SchemaPronounsTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaPronouns(schema)).toBe(false)
        })
    })

    describe('isSchemaCharacter', () => {
        it('should return true for valid SchemaCharacterTag', () => {
            const schema = { tag: 'Character', key: 'char1' }
            expect(isSchemaCharacter(schema)).toBe(true)
        })

        it('should return false for invalid SchemaCharacterTag', () => {
            const schema = { tag: 'Invalid', key: 'char1' }
            expect(isSchemaCharacter(schema)).toBe(false)
        })

        it('should return false for SchemaCharacterTag missing key', () => {
            const schema = { tag: 'Character' }
            expect(isSchemaCharacter(schema)).toBe(false)
        })
    })
})