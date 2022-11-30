import { extractDependenciesFromJS } from './utils'

describe('parser utilities', () => {
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
