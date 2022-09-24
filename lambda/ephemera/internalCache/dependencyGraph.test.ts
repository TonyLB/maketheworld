jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

import internalCache from "."
import { AssetStateMapping } from './assetState'
import { DependencyNode } from './dependencyGraph'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('DependencyGraph', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    const testStore: Record<string, DependencyNode> = {
        'VARIABLE#testOne': {
            EphemeraId: 'VARIABLE#testOne',
            tag: 'Variable',
            completeness: 'Complete',
            assets: [],
            connections: [
                { EphemeraId: 'COMPUTED#testTwo', assets: ['base'] },
                { EphemeraId: 'COMPUTED#testThree', assets: ['base'] }
            ]
        },
        'COMPUTED#testTwo': {
            EphemeraId: 'COMPUTED#testTwo',
            tag: 'Computed',
            completeness: 'Partial',
            assets: [],
            connections: [{ EphemeraId: 'COMPUTED#testThree', key: 'testTwo', assets: ['base'] }]
        },
        'COMPUTED#testThree': {
            EphemeraId: 'COMPUTED#testThree',
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
                Descent: [
                    {
                        EphemeraId: 'COMPUTED#testTwo',
                        tag: 'Computed',
                        connections: [{
                            EphemeraId: 'COMPUTED#testThree',
                            key: 'testTwo',
                            assets: ['base'],
                        }]
                    },
                    {
                        EphemeraId: 'COMPUTED#testThree',
                        tag: 'Computed',
                        connections: []
                    }
                ]
            })
            const output = await internalCache.Descent.get('COMPUTED#testTwo')
            expect(output).toMatchSnapshot()
        })
    })

    describe('getPartial', () => {
        it('should correctly decipher a partial tree', () => {
            internalCache.Descent._Store = { ...testStore }
    
            expect(internalCache.Descent.getPartial('VARIABLE#testOne')).toMatchSnapshot()
        })
    })

    describe('isComplete', () => {
        it('should correctly tag a partial tree', () => {
            internalCache.Descent._Store = { ...testStore }
    
            expect(internalCache.Descent.isComplete('VARIABLE#testOne')).toBe(false)
        })

        it('should correctly flag a complete tree', () => {
            internalCache.Descent._Store = {
                'VARIABLE#testOne': {
                    EphemeraId: 'VARIABLE#testOne',
                    tag: 'Variable',
                    completeness: 'Complete',
                    assets: [],
                    connections: [
                        { EphemeraId: 'COMPUTED#testTwo', key: 'testOne', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#testThree', key: 'testOne', assets: ['base'] }
                    ]
                },
                'COMPUTED#testTwo': {
                    EphemeraId: 'COMPUTED#testTwo',
                    tag: 'Computed',
                    completeness: 'Complete',
                    assets: [],
                    connections: [{ EphemeraId: 'COMPUTED#testThree', key: 'testTwo', assets: ['base'] }]
                },
                'COMPUTED#testThree': {
                    EphemeraId: 'COMPUTED#testThree',
                    tag: 'Computed',
                    completeness: 'Complete',
                    assets: [],
                    connections: []
                }
            }
    
            expect(internalCache.Descent.isComplete('VARIABLE#testOne')).toBe(true)
        })
    })

    describe('put', () => {
        it('should correctly add a single graph item', () => {
            internalCache.Descent._Store = testStore
            internalCache.Descent.put([{
                EphemeraId: 'COMPUTED#testFour',
                tag: 'Variable',
                completeness: 'Partial',
                assets: [],
                connections: [{ EphemeraId: 'COMPUTED#testTwo', key: 'testFour', assets: ['base'] }]
            }])
            expect(internalCache.Descent.getPartial('COMPUTED#testFour')).toMatchSnapshot()
        })

        it('should correctly add a complete tree', () => {
            internalCache.Descent._Store = { ...testStore }
            internalCache.Descent.put([
                {
                    EphemeraId: 'COMPUTED#testFour',
                    tag: 'Variable',
                    assets: [],
                    completeness: 'Complete',
                    connections: [
                        {
                            EphemeraId: 'COMPUTED#testTwo',
                            key: 'testFour',
                            assets: ['base'],
                        }
                    ]
                },
                {
                    EphemeraId: 'COMPUTED#testTwo',
                    tag: 'Computed',
                    key: 'testFour',
                    assets: ['base'],
                    completeness: 'Complete',
                    connections: []
                },
                {
                    EphemeraId: 'COMPUTED#testThree',
                    tag: 'Computed',
                    key: 'testTwo',
                    assets: ['base'],
                    completeness: 'Complete',
                    connections: []
                }
            ])
            expect(internalCache.Descent.getPartial('COMPUTED#testFour')).toMatchSnapshot()
        })

        it('should backpopulate antidependency links', () => {
            internalCache.Descent._Store = { ...testStore }
            internalCache.Descent.put([{
                EphemeraId: 'COMPUTED#testFour',
                tag: 'Variable',
                assets: ['base'],
                completeness: 'Partial',
                connections: [
                    {
                        EphemeraId: 'COMPUTED#testTwo',
                        key: 'testFour',
                        assets: ['base'],
                    }
                ]
            }])
            expect(internalCache.Ancestry.getPartial('COMPUTED#testTwo')).toMatchSnapshot()
        })
    })

    describe('delete', () => {
        it('should correctly delete a connection', () => {
            internalCache.Descent._Store = { ...testStore }
            internalCache.Descent.delete('COMPUTED#testTwo', { EphemeraId: 'COMPUTED#testThree', assets: ['base'] })
            expect(internalCache.Descent.getPartial('VARIABLE#testOne')).toMatchSnapshot()
        })

        it('should decrement connection assets when redundancies exist', () => {
            internalCache.Descent._Store = {
                'VARIABLE#testOne': {
                    EphemeraId: 'VARIABLE#testOne',
                    tag: 'Variable',
                    assets: [],
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#testTwo', assets: ['base', 'layer'] }
                    ]
                },
                'COMPUTED#testTwo': {
                    EphemeraId: 'COMPUTED#testTwo',
                    tag: 'Computed',
                    assets: [],
                    completeness: 'Partial',
                    connections: []
                }
            }
            internalCache.Descent.delete('VARIABLE#testOne', { EphemeraId: 'COMPUTED#testTwo', assets: ['layer'] })
            expect(internalCache.Descent.getPartial('VARIABLE#testOne')).toMatchSnapshot()
        })
    })
})