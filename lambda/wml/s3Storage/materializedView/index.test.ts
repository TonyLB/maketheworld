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
 *
 * Fixtures use `<Situation uuid=(DEFAULT)>` under `<Room>` (canonical room prose) rather than
 * `<Example ref={0}>` hosting.
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
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>Original Name</DisplayName>
                        </Situation>
                    </Room>
                </Asset>
            `)

            const chunkWML = `
                <Asset uuid=(test)>
                    <Room uuid=(testRoom)>
                        <Situation uuid=(DEFAULT) ref={0}>
                            <Description>Added description</Description>
                        </Situation>
                    </Room>
                </Asset>
            `

            const result = updateContentByChunk(baseline, chunkWML)

            expect(result).toBeInstanceOf(StandardForm)
            const serialized = schemaToWML([result.schema])
            expect(serialized).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) ref={2}>
                        <Situation uuid=(DEFAULT) ref={0} />
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>Original Name</DisplayName>
                            <Description>Added description</Description>
                        </Situation>
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
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>First Content</DisplayName>
                        </Situation>
                    </Room>
                </Asset>
            `

            const result = updateContentByChunk(emptyBaseline, chunkWML)

            expect(result).toBeInstanceOf(StandardForm)
            const serialized = schemaToWML([result.schema])
            expect(serialized).toEqual(deIndentWML(`
                <Asset uuid=(newAsset)>
                    <Room uuid=(newRoom)>
                        <Situation uuid=(DEFAULT) ref={0} />
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>First Content</DisplayName>
                        </Situation>
                    </Room>
                </Asset>
            `))
        })

        test('works with Replace/With pattern', () => {
            const baseline = new StandardForm(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom)>
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>Original</DisplayName>
                        </Situation>
                    </Room>
                </Asset>
            `)

            const chunkWML = `
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) ref={0}>
                        <Situation uuid=(DEFAULT) ref={0}>
                            <Replace>
                                <DisplayName>Original</DisplayName>
                            </Replace>
                            <With>
                                <DisplayName>Updated</DisplayName>
                            </With>
                        </Situation>
                    </Room>
                </Asset>
            `

            const result = updateContentByChunk(baseline, chunkWML)

            const serialized = schemaToWML([result.schema])
            expect(serialized).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom)>
                        <Situation uuid=(DEFAULT) ref={0} />
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>Updated</DisplayName>
                        </Situation>
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
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>Original</DisplayName>
                        </Situation>
                    </Room>
                </Asset>
            `)

            const originalSerialized = schemaToWML([baseline.schema])

            const chunk = `
                <Asset uuid=(test)>
                    <Room uuid=(testRoom)>
                        <Situation uuid=(DEFAULT) ref={0}>
                            <Description>Added</Description>
                        </Situation>
                    </Room>
                </Asset>
            `

            const result = updateContentByChunk(baseline, chunk)

            expect(schemaToWML([baseline.schema])).toBe(originalSerialized)
            expect(result).not.toBe(baseline)
            expect(schemaToWML([result.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) ref={2}>
                        <Situation uuid=(DEFAULT) ref={0} />
                        <Situation uuid=(DEFAULT)>
                            <DisplayName>Original</DisplayName>
                            <Description>Added</Description>
                        </Situation>
                    </Room>
                </Asset>
            `))
        })
    })
})
