/**
 * Materialized View Operations Tests
 * 
 * Test coverage for updateContentByChunk content reducer.
 * 
 * Focus: Test the wrapper function, not StandardForm.merge() (which is tested in mtw-wml).
 * - Does it correctly parse chunk WML?
 * - Does it call merge on the baseline?
 * - Does it return the merged result?
 * - Does it propagate errors?
 */

import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { updateContentByChunk } from '.'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('updateContentByChunk', () => {
    describe('basic functionality', () => {
        test('merges chunk WML into baseline', () => {
            const baseline = new StandardForm(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom)>
                        <Example uuid=(testExample)>
                            <Name>Original Name</Name>
                        </Example>
                    </Room>
                </Asset>
            `)
            
            const chunkWML = `
                <Asset uuid=(test)>
                    <Example uuid=(testExample) ref={0}>
                        <Description>Added description</Description>
                    </Example>
                </Asset>
            `
            
            const result = updateContentByChunk(baseline, chunkWML)
            
            // Verify merge occurred
            expect(result).toBeInstanceOf(StandardForm)
            const serialized = schemaToWML([result.schema])
            expect(serialized).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom)>
                        <Example uuid=(testExample)>
                            <Name>Original Name</Name>
                            <Description>Added description</Description>
                        </Example>
                    </Room>
                </Asset>
            `))
            expect(serialized).toContain('Added description')
        })
        
        test('works with empty baseline', () => {
            const emptyBaseline = new StandardForm('ASSET#newAsset')
            
            const chunkWML = `
                <Asset uuid=(newAsset)>
                    <Room uuid=(newRoom)>
                        <Example uuid=(newExample)>
                            <Name>First Content</Name>
                        </Example>
                    </Room>
                </Asset>
            `
            
            const result = updateContentByChunk(emptyBaseline, chunkWML)
            
            expect(result).toBeInstanceOf(StandardForm)
            const serialized = schemaToWML([result.schema])
            expect(serialized).toEqual(deIndentWML(`
                <Asset uuid=(newAsset)>
                    <Room uuid=(newRoom)>
                        <Example uuid=(newExample)><Name>First Content</Name></Example>
                    </Room>
                </Asset>
            `))
        })
        
        test('works with Replace/With pattern', () => {
            const baseline = new StandardForm(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom)>
                        <Example uuid=(testExample)>
                            <Name>Original</Name>
                        </Example>
                    </Room>
                </Asset>
            `)
            
            const chunkWML = `
                <Asset uuid=(test)>
                    <Example uuid=(testExample) ref={0}>
                        <Replace>
                            <Name>Original</Name>
                        </Replace>
                        <With>
                            <Name>Updated</Name>
                        </With>
                    </Example>
                </Asset>
            `
            
            const result = updateContentByChunk(baseline, chunkWML)
            
            const serialized = schemaToWML([result.schema])
            expect(serialized).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom)>
                        <Example uuid=(testExample)><Name>Updated</Name></Example>
                    </Room>
                </Asset>
            `))
            expect(serialized).not.toContain('Original')
        })
    })
    
    describe('error propagation', () => {
        test('propagates parsing errors from invalid WML', () => {
            const baseline = new StandardForm('ASSET#test')
            const invalidWML = '<Asset uuid=(test)><InvalidTag>broken'
            
            expect(() => {
                updateContentByChunk(baseline, invalidWML)
            }).toThrow()
        })
        
        test('propagates empty WML error', () => {
            const baseline = new StandardForm('ASSET#test')
            const emptyWML = ''
            
            expect(() => {
                updateContentByChunk(baseline, emptyWML)
            }).toThrow('Empty WML argument')
        })
    })
    
    describe('immutability', () => {
        test('does not mutate baseline StandardForm', () => {
            const baseline = new StandardForm(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom)>
                        <Example uuid=(testExample)>
                            <Name>Original</Name>
                        </Example>
                    </Room>
                </Asset>
            `)
            
            const originalSerialized = schemaToWML([baseline.schema])
            
            const chunk = `
                <Asset uuid=(test)>
                    <Example uuid=(testExample) ref={0}>
                        <Description>Added</Description>
                    </Example>
                </Asset>
            `
            
            const result = updateContentByChunk(baseline, chunk)
            
            // Baseline should be unchanged
            expect(schemaToWML([baseline.schema])).toBe(originalSerialized)
            // Result should be different instance with changes
            expect(result).not.toBe(baseline)
            expect(schemaToWML([result.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom)>
                        <Example uuid=(testExample)>
                            <Name>Original</Name>
                            <Description>Added</Description>
                        </Example>
                    </Room>
                </Asset>
            `))
        })
    })
})
