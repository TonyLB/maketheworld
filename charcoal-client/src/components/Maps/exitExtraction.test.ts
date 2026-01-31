import { describe, it, expect } from 'vitest'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { extractExitsFromStandardForm } from './exitExtraction'
import { MapExit } from './Controller/baseClasses'

describe('extractExitsFromStandardForm', () => {
    describe('basic functionality', () => {
        it('should return empty array for empty StandardForm', () => {
            const standardForm = new StandardForm('ASSET#empty')
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toEqual([])
        })

        it('should return empty array when mapId does not exist', () => {
            const standardForm = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Map uuid=(otherMap)>
                        <ShortName>Other Map</ShortName>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#nonexistentMap')
            
            expect(result).toEqual([])
        })

        it('should return empty array for map with no rooms', () => {
            const standardForm = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Map uuid=(testMap)>
                        <ShortName>Test Map</ShortName>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toEqual([])
        })

        it('should return empty array for map with rooms but no exits', () => {
            const standardForm = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Map uuid=(testMap)>
                        <ShortName>Test Map</ShortName>
                        <Room uuid=(room1)>
                            <Position {100, 100} />
                            <ShortName>Room One</ShortName>
                        </Room>
                        <Room uuid=(room2)>
                            <Position {200, 200} />
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
                <Asset uuid=(testAsset)>
                    <Map uuid=(testMap)>
                        <ShortName>Test Map</ShortName>
                        <Room uuid=(room1)>
                            <Position {100, 100} />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position {200, 200} />
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(1)
            expect(result[0]).toBeInstanceOf(MapExit)
            
            // Clean access via MapExit getters
            if (result[0] instanceof MapExit) {
                expect(result[0].from).toBe('ROOM#room1')
                expect(result[0].to).toBe('ROOM#room2')
                expect(result[0].description).toBe('to room two')
            }
        })

        it('should extract multiple exits from single room', () => {
            const standardForm = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Map uuid=(testMap)>
                        <ShortName>Test Map</ShortName>
                        <Room uuid=(room1)>
                            <Position {100, 100} />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                            <Exit to=(ROOM#room3)>to room three</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position {200, 200} />
                            <ShortName>Room Two</ShortName>
                        </Room>
                        <Room uuid=(room3)>
                            <Position {300, 300} />
                            <ShortName>Room Three</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(2)
            expect(result[0]).toBeInstanceOf(MapExit)
            expect(result[1]).toBeInstanceOf(MapExit)
            
            // Clean access via MapExit getters
            const exitTargets = result.map(exit => {
                if (exit instanceof MapExit) {
                    return exit.to
                }
                return ''
            })
            expect(exitTargets).toContain('ROOM#room2')
            expect(exitTargets).toContain('ROOM#room3')
        })

        it('should extract exits from multiple rooms', () => {
            const standardForm = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Map uuid=(testMap)>
                        <ShortName>Test Map</ShortName>
                        <Room uuid=(room1)>
                            <Position {100, 100} />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position {200, 200} />
                            <ShortName>Room Two</ShortName>
                            <Exit to=(ROOM#room3)>to room three</Exit>
                        </Room>
                        <Room uuid=(room3)>
                            <Position {300, 300} />
                            <ShortName>Room Three</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(2)
            
            const room1Exit = result.find(exit => {
                if (exit instanceof MapExit) {
                    return exit.from === 'ROOM#room1'
                }
                return false
            })
            const room2Exit = result.find(exit => {
                if (exit instanceof MapExit) {
                    return exit.from === 'ROOM#room2'
                }
                return false
            })
            
            expect(room1Exit).toBeDefined()
            if (room1Exit instanceof MapExit) {
                expect(room1Exit.to).toBe('ROOM#room2')
                expect(room1Exit.description).toBe('to room two')
            }
            
            expect(room2Exit).toBeDefined()
            if (room2Exit instanceof MapExit) {
                expect(room2Exit.to).toBe('ROOM#room3')
                expect(room2Exit.description).toBe('to room three')
            }
        })

        it('should filter out exits to rooms not positioned in the map', () => {
            const standardForm = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Map uuid=(testMap)>
                        <ShortName>Test Map</ShortName>
                        <Room uuid=(room1)>
                            <Position {100, 100} />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                            <Exit to=(ROOM#room3)>to room three</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position {200, 200} />
                            <ShortName>Room Two</ShortName>
                            <Exit to=(ROOM#room1)>to room one</Exit>
                        </Room>
                        <Room uuid=(room3)>
                            <ShortName>Room Three</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            // Should only include exits between positioned rooms
            expect(result).toHaveLength(2)
            
            const exitTargets = result.map(exit => {
                if (exit instanceof MapExit) {
                    return exit.to
                }
                return ''
            })
            
            // Should include exit to room2 (positioned)
            expect(exitTargets).toContain('ROOM#room2')
            // Should NOT include exit to room3 (not positioned)
            expect(exitTargets).not.toContain('ROOM#room3')
            
            // Verify the specific exits we expect
            const room1ToRoom2 = result.find(exit => {
                if (exit instanceof MapExit) {
                    return exit.from === 'ROOM#room1' && exit.to === 'ROOM#room2'
                }
                return false
            })
            const room2ToRoom1 = result.find(exit => {
                if (exit instanceof MapExit) {
                    return exit.from === 'ROOM#room2' && exit.to === 'ROOM#room1'
                }
                return false
            })
            
            expect(room1ToRoom2).toBeDefined()
            expect(room2ToRoom1).toBeDefined()
        })
    })

    describe('exit properties', () => {
        it('should preserve exit name data structure', () => {
            const standardForm = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Map uuid=(testMap)>
                        <ShortName>Test Map</ShortName>
                        <Room uuid=(room1)>
                            <Position {100, 100} />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>
                                Complex Exit Name
                                With Multiple Parts
                            </Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position {200, 200} />
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(1)
            expect(result[0]).toBeInstanceOf(MapExit)
            
            // Clean access via .payload instead of ._payload.plain
            if (result[0] instanceof MapExit) {
                const exitName = result[0].description
                expect(exitName).toBe('Complex Exit Name With Multiple Parts')
            }
        })

    })

    describe('combined form handling', () => {
        it('should extract exits from combined inherited and local data', () => {
            const standardForm = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Map uuid=(testMap)>
                        <ShortName>Test Map</ShortName>
                        <Room uuid=(room1) origin=(ASSET#parent)>
                            <Position {100, 100} />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>inherited exit</Exit>
                        </Room>
                        <Room uuid=(room2) origin=(ASSET#parent)>
                            <Position {200, 200} />
                            <ShortName>Room Two</ShortName>
                        </Room>
                        <Room uuid=(room3)>
                            <Position {300, 300} />
                            <ShortName>Room Three</ShortName>
                            <Exit to=(ROOM#room1)>local exit</Exit>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(2)
            
            // Should get both inherited and local exits
            const inheritedExit = result.find(exit => {
                if (exit instanceof MapExit) {
                    return exit.from === 'ROOM#room1'
                }
                return false
            })
            const localExit = result.find(exit => {
                if (exit instanceof MapExit) {
                    return exit.from === 'ROOM#room3'
                }
                return false
            })
            
            expect(inheritedExit).toBeDefined()
            expect(localExit).toBeDefined()
            if (inheritedExit instanceof MapExit) {
                expect(inheritedExit.description).toBe('inherited exit')
            }
            if (localExit instanceof MapExit) {
                expect(localExit.description).toBe('local exit')
            }
        })

        it('should handle local overrides of inherited exits', () => {
            const standardForm = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Map uuid=(testMap)>
                        <ShortName>Test Map</ShortName>
                        <Room uuid=(room1) origin=(ASSET#parent)>
                            <Position {100, 100} />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>inherited exit</Exit>
                        </Room>
                        <Room uuid=(room2) origin=(ASSET#parent)>
                            <Position {200, 200} />
                            <ShortName>Room Two</ShortName>
                        </Room>
                        <Room uuid=(room1)>
                            <Position {150, 150} />
                            <ShortName>Room One Local</ShortName>
                            <Replace><Exit to=(ROOM#room2)>inherited exit</Exit></Replace>
                            <With><Exit to=(ROOM#room2)>local override exit</Exit></With>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            // Should get the local override (StandardForm combination handles this)
            expect(result).toHaveLength(1)
            expect(result[0]).toBeInstanceOf(MapExit)
            if (result[0] instanceof MapExit) {
                expect(result[0].from).toBe('ROOM#room1')
                expect(result[0].to).toBe('ROOM#room2')
                expect(result[0].description).toBe('local override exit')
            }
        })
    })

    describe('edge cases', () => {
        it('should handle exits with missing name data', () => {
            const standardForm = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Map uuid=(testMap)>
                        <ShortName>Test Map</ShortName>
                        <Room uuid=(room1)>
                            <Position {100, 100} />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2) />
                        </Room>
                        <Room uuid=(room2)>
                            <Position {200, 200} />
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            const result = extractExitsFromStandardForm(standardForm, 'MAP#testMap')
            
            expect(result).toHaveLength(1)
            expect(result[0]).toBeInstanceOf(MapExit)
            if (result[0] instanceof MapExit) {
                expect(result[0].from).toBe('ROOM#room1')
                expect(result[0].to).toBe('ROOM#room2')
                expect(result[0].description).toBeUndefined()
            }
        })

        it('should handle rooms without positions', () => {
            const standardForm = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Map uuid=(testMap)>
                        <ShortName>Test Map</ShortName>
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
            
            expect(result).toHaveLength(0)
        })
    })

    describe('map filtering', () => {
        it('should only extract exits from specified map', () => {
            const standardForm = new StandardForm(`
                <Asset uuid=(testAsset)>
                    <Map uuid=(map1)>
                        <ShortName>Map One</ShortName>
                        <Room uuid=(room1)>
                            <Position {100, 100} />
                            <ShortName>Room One</ShortName>
                            <Exit to=(ROOM#room2)>to room two</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position {200, 200} />
                            <ShortName>Room Two</ShortName>
                        </Room>
                    </Map>
                    <Map uuid=(map2)>
                        <ShortName>Map Two</ShortName>
                        <Room uuid=(room3)>
                            <Position {300, 300} />
                            <ShortName>Room Three</ShortName>
                            <Exit to=(ROOM#room4)>to room four</Exit>
                        </Room>
                        <Room uuid=(room4)>
                            <Position {400, 400} />
                            <ShortName>Room Four</ShortName>
                        </Room>
                    </Map>
                </Asset>
            `)
            
            const result1 = extractExitsFromStandardForm(standardForm, 'MAP#map1')
            const result2 = extractExitsFromStandardForm(standardForm, 'MAP#map2')
            
            expect(result1).toHaveLength(1)
            expect(result1[0]).toBeInstanceOf(MapExit)
            if (result1[0] instanceof MapExit) {
                expect(result1[0].from).toBe('ROOM#room1')
                expect(result1[0].to).toBe('ROOM#room2')
            }
            
            expect(result2).toHaveLength(1)
            expect(result2[0]).toBeInstanceOf(MapExit)
            if (result2[0] instanceof MapExit) {
                expect(result2[0].from).toBe('ROOM#room3')
                expect(result2[0].to).toBe('ROOM#room4')
            }
        })
    })

})
