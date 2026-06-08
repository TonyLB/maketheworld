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

    describe('asset mode (room-local exits forbidden)', () => {
        it('returns empty when map rooms would have had legacy exits in asset authoring', () => {
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
            expect(result.every((exit) => exit instanceof MapExit)).toBe(true)
        })
    })
})
