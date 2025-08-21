import { describe, it, expect } from 'vitest'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { extractExitsFromStandardForm } from './exitExtraction'
import { StandardExit } from '@tonylb/mtw-wml/ts/standardize/components/exit'

describe('extractExitsFromStandardForm', () => {
    describe('basic functionality', () => {
        it('should return empty array for empty StandardForm', () => {
            const standardForm = new StandardForm('')
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toEqual([])
        })

        it('should return empty array when mapId does not exist', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(otherMap)>
                        <Name>Other Map</Name>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#nonexistentMap')
            
            expect(result).toEqual([])
        })

        it('should return empty array for map with no rooms', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toEqual([])
        })

        it('should return empty array for map with rooms but no exits', () => {
            const standardForm = new StandardForm(`
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
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toEqual([])
        })
    })

    describe('exit extraction', () => {
        it('should extract single exit from room', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(1)
            expect(result[0]).toBeInstanceOf(StandardExit)
            expect(result[0]._payload.plain.from.universalKey).toBe('ROOM#room1')
            expect(result[0]._payload.plain.to.universalKey).toBe('ROOM#room2')
        })

        it('should extract multiple exits from single room', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                            <Exit to=(ROOM#room3)>to room three</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                        </Room>
                        <Room uuid=(room3)>
                            <Position x="300" y="300" />
                            <ShortName>Room Three</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(2)
            expect(result[0]).toBeInstanceOf(StandardExit)
            expect(result[1]).toBeInstanceOf(StandardExit)
            
            const exitTargets = result.map(exit => exit._payload.plain.to.universalKey).sort()
            expect(exitTargets).toEqual(['ROOM#room2', 'ROOM#room3'])
        })

        it('should extract exits from multiple rooms', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                            <Exit to=(ROOM#room3)>to room three</Exit>
                        </Room>
                        <Room uuid=(room3)>
                            <Position x="300" y="300" />
                            <ShortName>Room Three</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(2)
            
            const room1Exit = result.find(exit => exit._payload.plain.from.universalKey === 'ROOM#room1')
            const room2Exit = result.find(exit => exit._payload.plain.from.universalKey === 'ROOM#room2')
            
            expect(room1Exit).toBeDefined()
            expect(room1Exit?._payload.plain.to.universalKey).toBe('ROOM#room2')
            
            expect(room2Exit).toBeDefined()
            expect(room2Exit?._payload.plain.to.universalKey).toBe('ROOM#room3')
        })
    })

    describe('exit properties', () => {
        it('should preserve exit name data structure', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>
                                <String>Complex Exit Name</String>
                                <String>With Multiple Parts</String>
                            </Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(1)
            expect(result[0]).toBeInstanceOf(StandardExit)
            
            // StandardExit preserves the rich name data structure
            const exitName = result[0]._payload.plain.name
            expect(exitName).toBeDefined()
        })

        it('should preserve exit metadata', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(1)
            expect(result[0]).toBeInstanceOf(StandardExit)
            
            // Should preserve all StandardExit properties
            expect(result[0].universalKey).toBeDefined()
            expect(result[0].key).toBeDefined()
            expect(result[0]._payload).toBeDefined()
        })
    })

    describe('combined form handling', () => {
        it('should extract exits from combined inherited and local data', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
                        <Room uuid=(room1) origin=(ASSET#parent)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>inherited exit</Exit>
                        </Room>
                        <Room uuid=(room2) origin=(ASSET#parent)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                        </Room>
                        <Room uuid=(room3)>
                            <Position x="300" y="300" />
                            <ShortName>Room Three</ShortName>
                            <Exit to=(ROOM#room1)>local exit</Exit>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(2)
            
            // Should get both inherited and local exits
            const inheritedExit = result.find(exit => exit._payload.plain.from.universalKey === 'ROOM#room1')
            const localExit = result.find(exit => exit._payload.plain.from.universalKey === 'ROOM#room3')
            
            expect(inheritedExit).toBeDefined()
            expect(localExit).toBeDefined()
        })

        it('should handle local overrides of inherited exits', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
                        <Room uuid=(room1) origin=(ASSET#parent)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>inherited exit</Exit>
                        </Room>
                        <Room uuid=(room2) origin=(ASSET#parent)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                        </Room>
                        <Room uuid=(room1)>
                            <Position x="150" y="150" />
                            <ShortName>Room One Local</ShortName>
                            <Exit to=(ROOM#room2)>local override exit</Exit>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            // Should get the local override (StandardForm combination handles this)
            expect(result).toHaveLength(1)
            expect(result[0]._payload.plain.from.universalKey).toBe('ROOM#room1')
            expect(result[0]._payload.plain.to.universalKey).toBe('ROOM#room2')
        })
    })

    describe('edge cases', () => {
        it('should handle exits to non-existent rooms', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#nonexistent)>to nowhere</Exit>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(1)
            expect(result[0]).toBeInstanceOf(StandardExit)
            expect(result[0]._payload.plain.to.universalKey).toBe('ROOM#nonexistent')
        })

        it('should handle exits with missing name data', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
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
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(1)
            expect(result[0]).toBeInstanceOf(StandardExit)
            expect(result[0]._payload.plain.from.universalKey).toBe('ROOM#room1')
            expect(result[0]._payload.plain.to.universalKey).toBe('ROOM#room2')
        })

        it('should handle rooms without positions', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(testMap)>
                        <Name>Test Map</Name>
                        <Room uuid=(room1)>
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(1)
            expect(result[0]).toBeInstanceOf(StandardExit)
            expect(result[0]._payload.plain.from.universalKey).toBe('ROOM#room1')
            expect(result[0]._payload.plain.to.universalKey).toBe('ROOM#room2')
        })
    })

    describe('map filtering', () => {
        it('should only extract exits from specified map', () => {
            const standardForm = new StandardForm(`
                <Asset key=(testAsset)>
                    <Map uuid=(map1)>
                        <Name>Map One</Name>
                        <Room uuid=(room1)>
                            <Position x="100" y="100" />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position x="200" y="200" />
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                    <Map uuid=(map2)>
                        <Name>Map Two</Name>
                        <Room uuid=(room3)>
                            <Position x="300" y="300" />
                            <ShortName>Room Three</ShortName>
                            <Exit to=(ROOM#room4)>to room four</Exit>
                        </Room>
                        <Room uuid=(room4)>
                            <Position x="400" y="400" />
                            <ShortName>Room Four</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            
            const result1 = extractExitsFromStandardForm(standardForm, 'MAP#map1')
            const result2 = extractExitsFromStandardForm(standardForm, 'MAP#map2')
            
            expect(result1).toHaveLength(1)
            expect(result1[0]._payload.plain.from.universalKey).toBe('ROOM#room1')
            expect(result1[0]._payload.plain.to.universalKey).toBe('ROOM#room2')
            
            expect(result2).toHaveLength(1)
            expect(result2[0]._payload.plain.from.universalKey).toBe('ROOM#room3')
            expect(result2[0]._payload.plain.to.universalKey).toBe('ROOM#room4')
        })
    })
})
