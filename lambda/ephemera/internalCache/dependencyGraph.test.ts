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
            connections: [
                { EphemeraId: 'testTwo', key: 'testOne' },
                { EphemeraId: 'testThree', key: 'testOne' }
            ]
        },
        testTwo: {
            EphemeraId: 'testTwo',
            tag: 'Computed',
            completeness: 'Partial',
            assets: ['base'],
            connections: [{ EphemeraId: 'testThree', key: 'testTwo' }]
        },
        testThree: {
            EphemeraId: 'testThree',
            tag: 'Computed',
            completeness: 'Partial',
            assets: ['base'],
            connections: []
        }
    }

    describe('get', () => {
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            internalCache.clear()
        })

        it('should correctly fetch a tree', async () => {
            internalCache.Descent._Store = { ...testStore }
            ephemeraMock.getItem.mockResolvedValue({
                Descent: [{
                    EphemeraId: 'testThree',
                    tag: 'Computed',
                    key: 'testTwo',
                    assets: ['base'],
                    connections: []
                }]
            })
            const output = await internalCache.Descent.get('testTwo', 'Computed')
            expect(output).toMatchSnapshot()
        })
    })

    describe('getPartial', () => {
        it('should correctly decipher a partial tree', () => {
            internalCache.Descent._Store = { ...testStore }
    
            expect(internalCache.Descent.getPartial('testOne')).toMatchSnapshot()
        })
    })

    describe('isComplete', () => {
        it('should correctly tag a partial tree', () => {
            internalCache.Descent._Store = { ...testStore }
    
            expect(internalCache.Descent.isComplete('testOne')).toBe(false)
        })

        it('should correctly flag a complete tree', () => {
            internalCache.Descent._Store = {
                testOne: {
                    EphemeraId: 'testOne',
                    tag: 'Variable',
                    completeness: 'Complete',
                    assets: ['base'],
                    connections: [
                        { EphemeraId: 'testTwo', key: 'testOne' },
                        { EphemeraId: 'testThree', key: 'testOne' }
                    ]
                },
                testTwo: {
                    EphemeraId: 'testTwo',
                    tag: 'Computed',
                    completeness: 'Complete',
                    assets: ['base'],
                    connections: [{ EphemeraId: 'testThree', key: 'testTwo' }]
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

    describe('put', () => {
        it('should correctly add a single graph item', () => {
            internalCache.Descent._Store = testStore
            internalCache.Descent.put({
                EphemeraId: 'testFour',
                tag: 'Variable',
                completeness: 'Complete',
                assets: ['base'],
                connections: [{ EphemeraId: 'testTwo', key: 'testFour' }]
            })
            expect(internalCache.Descent.getPartial('testFour')).toMatchSnapshot()
        })

        it('should correctly add a complete tree', () => {
            internalCache.Descent._Store = { ...testStore }
            internalCache.Descent.put({
                EphemeraId: 'testFour',
                tag: 'Variable',
                assets: ['base'],
                connections: [
                    {
                        EphemeraId: 'testTwo',
                        tag: 'Computed',
                        key: 'testFour',
                        assets: ['base'],
                        connections: [{
                            EphemeraId: 'testThree',
                            key: 'testTwo',
                            assets: ['base'],
                            connections: [],
                            tag: 'Computed'
                        }]
                    }
                ]
            })
            expect(internalCache.Descent.getPartial('testFour')).toMatchSnapshot()
        })
    })

    describe('delete', () => {
        it('should correctly delete a connection', () => {
            internalCache.Descent._Store = { ...testStore }
            internalCache.Descent.delete('testTwo', 'testThree')
            expect(internalCache.Descent.getPartial('testOne')).toMatchSnapshot()
        })
    })
})