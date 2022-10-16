jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

import internalCache from "."
import { DependencyNode } from './baseClasses'

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
            completeness: 'Complete',
            connections: [
                { EphemeraId: 'COMPUTED#testTwo', assets: ['base'] },
                { EphemeraId: 'COMPUTED#testThree', assets: ['base'] }
            ]
        },
        'COMPUTED#testTwo': {
            EphemeraId: 'COMPUTED#testTwo',
            completeness: 'Partial',
            connections: [{ EphemeraId: 'COMPUTED#testThree', key: 'testTwo', assets: ['base'] }]
        },
        'COMPUTED#testThree': {
            EphemeraId: 'COMPUTED#testThree',
            completeness: 'Partial',
            connections: []
        }
    }

    describe('get', () => {
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            internalCache.clear()
        })

        afterEach(async () => {
            await internalCache.flush()
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
                    completeness: 'Complete',
                    connections: [
                        { EphemeraId: 'COMPUTED#testTwo', key: 'testOne', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#testThree', key: 'testOne', assets: ['base'] }
                    ]
                },
                'COMPUTED#testTwo': {
                    EphemeraId: 'COMPUTED#testTwo',
                    completeness: 'Complete',
                    connections: [{ EphemeraId: 'COMPUTED#testThree', key: 'testTwo', assets: ['base'] }]
                },
                'COMPUTED#testThree': {
                    EphemeraId: 'COMPUTED#testThree',
                    completeness: 'Complete',
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
                completeness: 'Partial',
                connections: [{ EphemeraId: 'COMPUTED#testTwo', key: 'testFour', assets: ['base'] }]
            }])
            expect(internalCache.Descent.getPartial('COMPUTED#testFour')).toMatchSnapshot()
        })

        it('should correctly add a complete tree', () => {
            internalCache.Descent._Store = { ...testStore }
            internalCache.Descent.put([
                {
                    EphemeraId: 'COMPUTED#testFour',
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
                    completeness: 'Partial',
                    connections: []
                },
                {
                    EphemeraId: 'COMPUTED#testThree',
                    completeness: 'Partial',
                    connections: []
                }
            ])
            expect(internalCache.Descent.getPartial('COMPUTED#testFour')).toMatchSnapshot()
        })

        it('should backpopulate antidependency links', () => {
            internalCache.Descent._Store = { ...testStore }
            internalCache.Descent.put([{
                EphemeraId: 'COMPUTED#testFour',
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
            internalCache.Descent.delete('COMPUTED#testTwo', { EphemeraId: 'COMPUTED#testThree', key: 'testTwo', assets: ['base'] })
            expect(internalCache.Descent.getPartial('VARIABLE#testOne')).toMatchSnapshot()
        })

        it('should decrement connection assets when redundancies exist', () => {
            internalCache.Descent._Store = {
                'VARIABLE#testOne': {
                    EphemeraId: 'VARIABLE#testOne',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#testTwo', assets: ['base', 'layer'] }
                    ]
                },
                'COMPUTED#testTwo': {
                    EphemeraId: 'COMPUTED#testTwo',
                    completeness: 'Partial',
                    connections: []
                }
            }
            internalCache.Descent.delete('VARIABLE#testOne', { EphemeraId: 'COMPUTED#testTwo', assets: ['layer'] })
            expect(internalCache.Descent.getPartial('VARIABLE#testOne')).toMatchSnapshot()
        })
    })

    describe('generationOrder', () => {
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            internalCache.clear()
        })

        it('should correctly calculate generation order for a complex graph', () => {
            internalCache.Descent._Store = {
                'VARIABLE#One': {
                    EphemeraId: 'VARIABLE#One',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Two', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Three', assets: ['base'] }
                    ]
                },
                'COMPUTED#Two': {
                    EphemeraId: 'COMPUTED#Two',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Four', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Five', assets: ['base'] }
                    ]
                },
                'COMPUTED#Three': {
                    EphemeraId: 'COMPUTED#Three',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Five', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Six', assets: ['base'] }
                    ]
                },
                'COMPUTED#Four': {
                    EphemeraId: 'COMPUTED#Four',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                    ]
                },
                'COMPUTED#Five': {
                    EphemeraId: 'COMPUTED#Five',
                    completeness: 'Partial',
                    connections: []
                },
                'COMPUTED#Six': {
                    EphemeraId: 'COMPUTED#Six',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                    ]
                },
                'COMPUTED#Seven': {
                    EphemeraId: 'COMPUTED#Seven',
                    completeness: 'Partial',
                    connections: []
                }
            }
            expect(internalCache.Descent.generationOrder(['COMPUTED#Seven', 'COMPUTED#Four', 'COMPUTED#Two', 'VARIABLE#One', 'COMPUTED#Six'])).toMatchSnapshot()
        })
    })

    describe('getBatch', () => {
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            internalCache.clear()
        })
    
        it('should correctly create a minimal covering-set of dependency fetches', async () => {
            internalCache.Descent._Store = {
                'VARIABLE#One': {
                    EphemeraId: 'VARIABLE#One',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Two', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Three', assets: ['base'] }
                    ]
                },
                'COMPUTED#Two': {
                    EphemeraId: 'COMPUTED#Two',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Four', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Five', assets: ['base'] }
                    ]
                },
                'COMPUTED#Three': {
                    EphemeraId: 'COMPUTED#Three',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Five', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Six', assets: ['base'] }
                    ]
                },
                'COMPUTED#Four': {
                    EphemeraId: 'COMPUTED#Four',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                    ]
                },
                'COMPUTED#Five': {
                    EphemeraId: 'COMPUTED#Five',
                    completeness: 'Partial',
                    connections: []
                },
                'COMPUTED#Six': {
                    EphemeraId: 'COMPUTED#Six',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                    ]
                },
                'COMPUTED#Seven': {
                    EphemeraId: 'COMPUTED#Seven',
                    completeness: 'Partial',
                    connections: []
                }
            }
            ephemeraMock.batchGetItem.mockResolvedValue([
                {
                    Descent: [
                        {
                            EphemeraId: 'COMPUTED#Two',
                            connections: [
                                { EphemeraId: 'COMPUTED#Four', assets: ['base'] },
                                { EphemeraId: 'COMPUTED#Five', assets: ['base'] },
                                { EphemeraId: 'COMPUTED#Eight', assets: ['layer'] }
                            ]
                        },
                        {
                            EphemeraId: 'COMPUTED#Four',
                            connections: [
                                { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                            ]
                        },
                        {
                            EphemeraId: 'COMPUTED#Five',
                            connections: []
                        },
                        {
                            EphemeraId: 'COMPUTED#Seven',
                            connections: []
                        },
                        {
                            EphemeraId: 'COMPUTED#Eight',
                            connections: []
                        }
                    ]
                },
                {
                    Descent: [
                        {
                            EphemeraId: 'COMPUTED#Three',
                            connections: [
                                { EphemeraId: 'COMPUTED#Five', assets: ['base'] },
                                { EphemeraId: 'COMPUTED#Six', assets: ['base'] }
                            ]
                        },
                        {
                            EphemeraId: 'COMPUTED#Five',
                            connections: []
                        },
                        {
                            EphemeraId: 'COMPUTED#Six',
                            connections: [
                                { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                            ]
                        },
                        {
                            EphemeraId: 'COMPUTED#Seven',
                            connections: []
                        }
                    ]
                }
            ])

            const output = await internalCache.Descent.getBatch(['COMPUTED#Two', 'COMPUTED#Three', 'COMPUTED#Five', 'COMPUTED#Seven'])
            expect(output).toEqual([
                {
                    EphemeraId: 'COMPUTED#Two',
                    completeness: 'Complete',
                    connections: [
                        { EphemeraId: 'COMPUTED#Four', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Five', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Eight', assets: ['layer'] }
                    ]
                },
                {
                    EphemeraId: 'COMPUTED#Four',
                    completeness: 'Complete',
                    connections: [
                        { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                    ]
                },
                {
                    EphemeraId: 'COMPUTED#Seven',
                    completeness: 'Complete',
                    connections: []
                },
                {
                    EphemeraId: 'COMPUTED#Five',
                    completeness: 'Complete',
                    connections: []
                },
                {
                    EphemeraId: 'COMPUTED#Eight',
                    completeness: 'Complete',
                    connections: []
                },
                {
                    EphemeraId: 'COMPUTED#Three',
                    completeness: 'Complete',
                    connections: [
                        { EphemeraId: 'COMPUTED#Five', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Six', assets: ['base'] }
                    ]
                },
                {
                    EphemeraId: 'COMPUTED#Six',
                    completeness: 'Complete',
                    connections: [
                        { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                    ]
                }
            ])
            expect(ephemeraDB.batchGetItem).toHaveBeenCalledTimes(1)
            expect(ephemeraDB.batchGetItem).toHaveBeenCalledWith({
                Items: [
                    { EphemeraId: 'COMPUTED#Two', DataCategory: 'Meta::Computed' },
                    { EphemeraId: 'COMPUTED#Three', DataCategory: 'Meta::Computed' }
                ],
                ProjectionFields: ['Descent']
            })

        })
    })
})