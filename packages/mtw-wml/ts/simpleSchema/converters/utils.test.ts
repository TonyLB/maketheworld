import { validateContents, extractDependenciesFromJS } from './utils'

describe('parser utilities', () => {
    describe('validateContents', () => {
        it('should return true on empty contents', () => {
            expect(validateContents({ isValid: () => (false), branchTags: ['Room'], leafTags: ['Name', 'Exit'] })([])).toBe(true)
        })

        it('should reject on failed isValid', () => {
            expect(validateContents({
                isValid: (tag) => {
                    if (tag.tag === 'Room' && (typeof tag.x === 'undefined' || typeof tag.y === 'undefined')) {
                        return false
                    }
                    return true
                },
                branchTags: [],
                leafTags: ['Room']
            })([
                { tag: 'Room', name: [], render: [], contents: [], key: 'ABC', x: 0, y: 100 },
                { tag: 'Room', name: [], render: [], contents: [], key: 'DEF' },                
            ])).toBe(false)
        })

        it('should accept on successful isValid', () => {
            expect(validateContents({
                isValid: (tag) => {
                    if (tag.tag === 'Room' && (typeof tag.x === 'undefined' || typeof tag.y === 'undefined')) {
                        return false
                    }
                    return true
                },
                branchTags: [],
                leafTags: ['Room']
            })([
                { tag: 'Room', name: [], render: [], contents: [], key: 'ABC', x: 0, y: 100 },
                { tag: 'Room', name: [], render: [], contents: [], key: 'DEF', x: 0, y: 0 },                
            ])).toBe(true)
        })

        it('should not recurse past labelled tags', () => {
            expect(validateContents({
                isValid: (tag) => {
                    if (tag.tag === 'Exit' && !(tag.name)) {
                        return false
                    }
                    return true
                },
                branchTags: [],
                leafTags: ['Room']
            })([
                { tag: 'Room', name: [], render: [], contents: [
                    { tag: 'Exit', key: 'ABC#DEF', from: 'ABC', to: 'DEF', name: '', contents: [] }
                ], key: 'ABC' }
            ])).toBe(true)
        })

        it('should recurse into labelled tags', () => {
            expect(validateContents({
                isValid: (tag) => {
                    if (tag.tag === 'Exit' && !(tag.name)) {
                        return false
                    }
                    return true
                },
                branchTags: ['Room'],
                leafTags: ['Exit']
            })([
                { tag: 'Room', name: [], render: [], contents: [
                    { tag: 'Exit', key: 'ABC#DEF', from: 'ABC', to: 'DEF', name: '', contents: [] }
                ], key: 'ABC' }
            ])).toBe(false)
        })

    })

    describe('extractDependenciesFromJS', () => {
        it('should extract top-level globals', () => {
            expect(extractDependenciesFromJS('testVariableOne && !testVariableTwo')).toEqual(['testVariableOne', 'testVariableTwo'])
        })

        it('should ignore function arguments', () => {
            expect(extractDependenciesFromJS('(localVariable) => (localVariable)(globalVariable)')).toEqual(['globalVariable'])
        })

        it('should ignore local variables', () => {
            expect(extractDependenciesFromJS(`
                (() => {
                    const localVariable = globalVariable * 2
                    return localVariable
                })()
            `)).toEqual(['globalVariable'])
        })
    })
})
