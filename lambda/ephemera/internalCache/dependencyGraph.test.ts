jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

import internalCache from "."
import { AssetStateMapping } from './assetState'
import { DependencyNodeGraphItem } from './dependencyGraph'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('DependencyGraph', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    const testStore: Record<string, DependencyNodeGraphItem> = {
        testOne: {
            EphemeraId: 'testOne',
            tag: 'Variable',
            completeness: 'Complete',
            assets: ['base'],
            connections: ['testTwo', 'testThree']
        },
        testTwo: {
            EphemeraId: 'testTwo',
            tag: 'Computed',
            completeness: 'Partial',
            assets: ['base'],
            connections: ['testThree']
        },
        testThree: {
            EphemeraId: 'testThree',
            tag: 'Computed',
            completeness: 'Partial',
            assets: ['base'],
            connections: []
        }
    }

    describe('getPartial', () => {
        it('should correctly decipher a partial tree', () => {
            internalCache.Descent._Store = testStore
    
            expect(internalCache.Descent.getPartial('testOne')).toMatchSnapshot()
        })
    })

    describe('isComplete', () => {
        it('should correctly tag a partial tree', () => {
            internalCache.Descent._Store = {
                testOne: {
                    EphemeraId: 'testOne',
                    tag: 'Variable',
                    completeness: 'Complete',
                    assets: ['base'],
                    connections: ['testTwo', 'testThree']
                },
                testTwo: {
                    EphemeraId: 'testTwo',
                    tag: 'Computed',
                    completeness: 'Partial',
                    assets: ['base'],
                    connections: ['testThree']
                },
                testThree: {
                    EphemeraId: 'testThree',
                    tag: 'Computed',
                    completeness: 'Partial',
                    assets: ['base'],
                    connections: []
                }
            }
    
            expect(internalCache.Descent.isComplete('testOne')).toBe(false)
        })

        it('should correctly flag a complete tree', () => {
            internalCache.Descent._Store = {
                testOne: {
                    EphemeraId: 'testOne',
                    tag: 'Variable',
                    completeness: 'Complete',
                    assets: ['base'],
                    connections: ['testTwo', 'testThree']
                },
                testTwo: {
                    EphemeraId: 'testTwo',
                    tag: 'Computed',
                    completeness: 'Complete',
                    assets: ['base'],
                    connections: ['testThree']
                },
                testThree: {
                    EphemeraId: 'testThree',
                    tag: 'Computed',
                    completeness: 'Complete',
                    assets: ['base'],
                    connections: []
                }
            }
    
            expect(internalCache.Descent.isComplete('testOne')).toBe(true)
        })
    })
})