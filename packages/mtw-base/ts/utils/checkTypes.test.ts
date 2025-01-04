import checkTypes, { CheckTypes } from './checkTypes'

describe('checkTypes', () => {
    it('should return true for valid required types', () => {
        const props = {
            required: {
                name: CheckTypes.STRING,
                age: CheckTypes.NUMBER,
                isActive: CheckTypes.BOOLEAN,
            },
        }
        const args = {
            name: 'John',
            age: 30,
            isActive: true,
        }
        expect(checkTypes(props)(args)).toBe(true)
    })

    it('should return false for invalid required types', () => {
        const props = {
            required: {
                name: CheckTypes.STRING,
                age: CheckTypes.NUMBER,
                isActive: CheckTypes.BOOLEAN,
            },
        }
        const args = {
            name: 'John',
            age: '30', // Invalid type
            isActive: true,
        }
        expect(checkTypes(props)(args)).toBe(false)
    })

    it('should return true for valid optional types', () => {
        const props = {
            required: {
                name: CheckTypes.STRING,
            },
            optional: {
                age: CheckTypes.NUMBER,
                isActive: CheckTypes.BOOLEAN,
            },
        }
        const args = {
            name: 'John',
            age: 30,
        }
        expect(checkTypes(props)(args)).toBe(true)
    })

    it('should return false for invalid optional types', () => {
        const props = {
            required: {
                name: CheckTypes.STRING,
            },
            optional: {
                age: CheckTypes.NUMBER,
                isActive: CheckTypes.BOOLEAN,
            },
        }
        const args = {
            name: 'John',
            age: '30', // Invalid type
        }
        expect(checkTypes(props)(args)).toBe(false)
    })

    it('should return true when optional properties are missing', () => {
        const props = {
            required: {
                name: CheckTypes.STRING,
            },
            optional: {
                age: CheckTypes.NUMBER,
                isActive: CheckTypes.BOOLEAN,
            },
        }
        const args = {
            name: 'John',
        }
        expect(checkTypes(props)(args)).toBe(true)
    })

    it('should return false when required properties are missing', () => {
        const props = {
            required: {
                name: CheckTypes.STRING,
                age: CheckTypes.NUMBER,
            },
        }
        const args = {
            name: 'John',
        }
        expect(checkTypes(props)(args)).toBe(false)
    })

    it('should return false when args is not an object', () => {
        const props = {
            required: {
                name: CheckTypes.STRING,
            },
        }
        const args = 'not an object'
        expect(checkTypes(props)(args)).toBe(false)
    })

    it('should return true for valid values', () => {
        const props = {
            required: {
                name: CheckTypes.STRING,
            },
            values: {
                name: 'John',
            },
        }
        const args = {
            name: 'John',
        }
        expect(checkTypes(props)(args)).toBe(true)
    })

    it('should return false for invalid values', () => {
        const props = {
            required: {
                name: CheckTypes.STRING,
            },
            values: {
                name: 'John',
            },
        }
        const args = {
            name: 'Doe',
        }
        expect(checkTypes(props)(args)).toBe(false)
    })

    it('should return true for valid required, optional, and values', () => {
        const props = {
            required: {
                name: CheckTypes.STRING,
            },
            optional: {
                age: CheckTypes.NUMBER,
            },
            values: {
                name: 'John',
            },
        }
        const args = {
            name: 'John',
            age: 30,
        }
        expect(checkTypes(props)(args)).toBe(true)
    })

    it('should return false for invalid required, optional, and values', () => {
        const props = {
            required: {
                name: CheckTypes.STRING,
            },
            optional: {
                age: CheckTypes.NUMBER,
            },
            values: {
                name: 'John',
            },
        }
        const args = {
            name: 'Doe',
            age: '30', // Invalid type
        }
        expect(checkTypes(props)(args)).toBe(false)
    })
})