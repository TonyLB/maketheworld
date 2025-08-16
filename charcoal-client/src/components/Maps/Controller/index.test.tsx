import React from 'react'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { mapTreeMemo } from './index'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'

// Mock dependencies
vi.mock('../../Library/Edit/LibraryAsset', () => ({
    useLibraryAsset: () => ({
        AssetId: 'ASSET#test',
        standardForm: new StandardForm('test'),
        inheritedByAssetId: [],
        updateStandard: vi.fn()
    })
}))

vi.mock('../../../slices/UI/mapEdit', () => ({
    toggle: vi.fn()
}))

vi.mock('../../../slices/personalAssets', () => ({
    addImport: vi.fn()
}))

vi.mock('../../../slices/player/index.api', () => ({
    addOnboardingComplete: vi.fn()
}))

// Create a test store
const createTestStore = () => configureStore({
    reducer: {
        // Add any reducers needed for testing
    }
})

describe('mapTreeMemo', () => {
    describe('basic functionality', () => {
        it('should return a StandardForm containing the map item', () => {
            const testWML = `
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                        </Room>
                        <Room uuid=(room2)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `
            const standardForm = new StandardForm(testWML)
            console.log(JSON.stringify(standardForm.toJSON(), null, 2))
            const result = mapTreeMemo(standardForm, 'MAP#testMap')
            
            expect(result).toBeInstanceOf(StandardForm)
            expect(result.key).toBe('mapTree')
            
            // Should contain the map component
            const mapComponent = result.byUniversalId['MAP#testMap']
            expect(mapComponent).toBeDefined()
            expect(schemaToWML([mapComponent.schema])).toEqual(deIndentWML(`
                <Map uuid=(testMap)>
                    <Name>Test Map</Name>
                    <Room uuid=(room1)><Position x="100" y="100" /></Room>
                    <Room uuid=(room2)><Position x="200" y="200" /></Room>
                </Map>
            `))
        })

        it('should include room stubs with ShortNames', () => {
            const testWML = `
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                        </Room>
                        <Room uuid=(room2)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `
            const standardForm = new StandardForm(testWML)
            const result = mapTreeMemo(standardForm, 'MAP#testMap')
            
            // Should contain room stubs
            const room1 = result.byUniversalId['ROOM#room1']
            const room2 = result.byUniversalId['ROOM#room2']
            
            expect(room1).toBeDefined()
            expect(schemaToWML([room1.schema])).toEqual(deIndentWML(`
                <Room uuid=(room1)><ShortName>Room One</ShortName></Room>
            `))
            
            expect(room2).toBeDefined()
            expect(schemaToWML([room2.schema])).toEqual(deIndentWML(`
                <Room uuid=(room2)><ShortName>Room Two</ShortName></Room>
            `))
        })

        it('should include relevant exits for each room', () => {
            const testWML = `
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                            <Exit to=(ROOM#room3)>to room three</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                            <Exit to=(ROOM#room1)>to room one</Exit>
                        </Room>
                    </Map>
                </Asset>
            `
            const standardForm = new StandardForm(testWML)
            const result = mapTreeMemo(standardForm, 'MAP#testMap')
            console.log(JSON.stringify(result.toJSON(), null, 2))

            const room1 = result.byUniversalId['ROOM#room1']
            const room2 = result.byUniversalId['ROOM#room2']
            expect(room1).toBeInstanceOf(StandardRoom)
            expect(room2).toBeInstanceOf(StandardRoom)
            if (room1 instanceof StandardRoom && room2 instanceof StandardRoom) {
                expect(room1.exits).toHaveLength(1)
                expect(schemaToWML(room1.exits[0].schema)).toEqual(deIndentWML(`
                    <Exit to=(ROOM#room2)>to room two</Exit>
                `))
                
                expect(room2.exits).toHaveLength(1)
                expect(schemaToWML(room2.exits[0].schema)).toEqual(deIndentWML(`
                    <Exit to=(ROOM#room1)>to room one</Exit>
                `))
            }
        })
    })

    describe('room stub content', () => {
        it('should include only ShortName and exits in room stubs', () => {
            const testWML = `
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                            <Example key=(example1)>
                                <Description>This should not be included</Description>
                            </Example>
                            <Feature key=(feature1)>
                                <Description>This should not be included</Description>
                            </Feature>
                        </Room>
                        <Room uuid=(room2)><Position x="200" y="200" /></Room>
                    </Map>
                </Asset>
            `
            const standardForm = new StandardForm(testWML)
            const result = mapTreeMemo(standardForm, 'MAP#testMap')
            
            const room1 = result.byUniversalId['ROOM#room1']
            expect(room1).toBeInstanceOf(StandardRoom)
            if (room1 instanceof StandardRoom) {
                // Should have ShortName
                expect(room1.shortName?.toJSON()).toBe('Room One')
                
                // Should have exits
                expect(room1.exits).toHaveLength(1)
                
                // Should NOT have examples, features, or other content
                expect(room1.examples.payload).toHaveLength(0)
                expect(room1.features.payload).toHaveLength(0)
                expect(room1.characters.payload).toHaveLength(0)
            }
            
        })

        it('should handle rooms without ShortNames', () => {
            const testWML = `
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                        </Room>
                    </Map>
                </Asset>
            `
            const standardForm = new StandardForm(testWML)
            const result = mapTreeMemo(standardForm, 'MAP#testMap')
            
            const room1 = result.byUniversalId['ROOM#room1']
            expect(room1).toBeInstanceOf(StandardRoom)
            if (room1 instanceof StandardRoom) {
                expect(room1.shortName).toBeUndefined()
                expect(room1.exits).toHaveLength(0)
            }
        })
    })

    describe('exit handling', () => {
        it('should include exit descriptions when present', () => {
            const testWML = `
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>North to Room Two</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `
            const standardForm = new StandardForm(testWML)
            const result = mapTreeMemo(standardForm, 'MAP#testMap')
            
            const room1 = result.byUniversalId['ROOM#room1']
            expect(room1).toBeInstanceOf(StandardRoom)
            if (room1 instanceof StandardRoom) {
                expect(schemaToWML(room1.exits[0].schema)).toEqual(deIndentWML(`
                    <Exit to=(ROOM#room2)>North to Room Two</Exit>
                `))
            }
        })

        it('should handle exits without descriptions', () => {
            const testWML = `
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2) />
                        </Room>
                        <Room uuid=(room2)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `
            const standardForm = new StandardForm(testWML)
            const result = mapTreeMemo(standardForm, 'MAP#testMap')
            
            const room1 = result.byUniversalId['ROOM#room1']
            expect(room1).toBeInstanceOf(StandardRoom)
            if (room1 instanceof StandardRoom) {
                expect(schemaToWML(room1.exits[0].schema)).toEqual(deIndentWML(`
                    <Exit to=(ROOM#room2) />
                `))
            }
        })
    })

    describe('error handling', () => {
        it('should throw error for invalid map ID format', () => {
            const testWML = `
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `
            const standardForm = new StandardForm(testWML)
            
            expect(() => {
                mapTreeMemo(standardForm, 'invalidMapId' as any)
            }).toThrow()
        })

        it('should handle maps with no rooms', () => {
            const testWML = `
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Empty Map</Name>
                    </Map>
                </Asset>
            `
            const standardForm = new StandardForm(testWML)
            const result = mapTreeMemo(standardForm, 'MAP#testMap')
            
            const mapComponent = result.byUniversalId['MAP#testMap']
            expect(mapComponent).toBeInstanceOf(StandardMap)
            if (mapComponent instanceof StandardMap) {
                expect(mapComponent.positions).toHaveLength(0)
            }
        })
    })
})
