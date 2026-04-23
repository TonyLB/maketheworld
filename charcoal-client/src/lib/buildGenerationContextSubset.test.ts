import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardKey } from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { buildGenerationContextSubset } from './buildGenerationContextSubset'

describe('buildGenerationContextSubset', () => {
    it('returns subset for minimal Asset with one Room, Lens, Mark, and Guidance', () => {
        const inputWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Mark uuid=(mark1)><ShortName>Illumination</ShortName></Mark>
                    </Lens>
                    <Guidance uuid=(guid1) key=(guid1)>
                        <ShortName>Bright mood</ShortName>
                        <Instructions>Be descriptive; emphasize light and clarity.</Instructions>
                        <Mark uuid=(mark1)><Match>Bright</Match></Mark>
                    </Guidance>
                </Room>
            </Asset>
        `)
        const form = new StandardForm(inputWML)
        const roomKey = new StandardKey({ key: 'room1', tag: 'Room' })
        const result = buildGenerationContextSubset(form, roomKey)
        const expectedWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Mark uuid=(mark1)><ShortName>Illumination</ShortName></Mark>
                    </Lens>
                    <Guidance uuid=(guid1) key=(guid1)>
                        <ShortName>Bright mood</ShortName>
                        <Instructions>
                            Be descriptive; emphasize light and clarity.
                        </Instructions>
                        <Mark uuid=(mark1)><Match>Bright</Match></Mark>
                    </Guidance>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([result.schema])).toEqual(expectedWML)
    })

    it('returns subset for Room with multiple Guidance components', () => {
        const inputWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Mark uuid=(mark1)><ShortName>Weather</ShortName></Mark>
                    </Lens>
                    <Guidance uuid=(guid1) key=(guid1)>
                        <ShortName>Sunny mood</ShortName>
                        <Instructions>Emphasize warmth and visibility.</Instructions>
                        <Mark uuid=(mark1)><Match>Sunny</Match></Mark>
                    </Guidance>
                    <Guidance uuid=(guid2) key=(guid2)>
                        <ShortName>Cloudy tone</ShortName>
                        <Instructions>Softer light, subdued atmosphere.</Instructions>
                        <Mark uuid=(mark1)><Match>Cloudy</Match></Mark>
                    </Guidance>
                </Room>
            </Asset>
        `)
        const form = new StandardForm(inputWML)
        const roomKey = new StandardKey({ key: 'room1', tag: 'Room' })
        const result = buildGenerationContextSubset(form, roomKey)
        const expectedWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Mark uuid=(mark1)><ShortName>Weather</ShortName></Mark>
                    </Lens>
                    <Guidance uuid=(guid1) key=(guid1)>
                        <ShortName>Sunny mood</ShortName>
                        <Instructions>Emphasize warmth and visibility.</Instructions>
                        <Mark uuid=(mark1)><Match>Sunny</Match></Mark>
                    </Guidance>
                    <Guidance uuid=(guid2) key=(guid2)>
                        <ShortName>Cloudy tone</ShortName>
                        <Instructions>Softer light, subdued atmosphere.</Instructions>
                        <Mark uuid=(mark1)><Match>Cloudy</Match></Mark>
                    </Guidance>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([result.schema])).toEqual(expectedWML)
    })

    it('returns subset for Lens with multiple Marks', () => {
        const inputWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Mark uuid=(mark1)><ShortName>Illumination</ShortName></Mark>
                        <Mark uuid=(mark2)><ShortName>Weather</ShortName></Mark>
                    </Lens>
                    <Guidance uuid=(guid1) key=(guid1)>
                        <ShortName>Default mood</ShortName>
                        <Instructions>Neutral tone for mixed conditions.</Instructions>
                        <Mark uuid=(mark1)><Match>Dim</Match></Mark>
                        <Mark uuid=(mark2)><Match>Calm</Match></Mark>
                    </Guidance>
                </Room>
            </Asset>
        `)
        const form = new StandardForm(inputWML)
        const roomKey = new StandardKey({ key: 'room1', tag: 'Room' })
        const result = buildGenerationContextSubset(form, roomKey)
        const expectedWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Mark uuid=(mark1)><ShortName>Illumination</ShortName></Mark>
                        <Mark uuid=(mark2)><ShortName>Weather</ShortName></Mark>
                    </Lens>
                    <Guidance uuid=(guid1) key=(guid1)>
                        <ShortName>Default mood</ShortName>
                        <Instructions>Neutral tone for mixed conditions.</Instructions>
                        <Mark uuid=(mark1)><Match>Dim</Match></Mark>
                        <Mark uuid=(mark2)><Match>Calm</Match></Mark>
                    </Guidance>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([result.schema])).toEqual(expectedWML)
    })

    it('excludes a second Room when subsetting by one Room', () => {
        const inputWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Mark uuid=(mark1)><ShortName>Illumination</ShortName></Mark>
                    </Lens>
                    <Guidance uuid=(guid1) key=(guid1)>
                        <ShortName>Bright mood</ShortName>
                        <Instructions>Emphasize light.</Instructions>
                        <Mark uuid=(mark1)><Match>Bright</Match></Mark>
                    </Guidance>
                </Room>
                <Room uuid=(room2) key=(room2)>
                    <ShortName>Other Room</ShortName>
                    <Lens uuid=(lens2)><Mark uuid=(mark2)><ShortName>Noise</ShortName></Mark></Lens>
                </Room>
            </Asset>
        `)
        const form = new StandardForm(inputWML)
        const roomKey = new StandardKey({ key: 'room1', tag: 'Room' })
        const result = buildGenerationContextSubset(form, roomKey)
        const expectedWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Mark uuid=(mark1)><ShortName>Illumination</ShortName></Mark>
                    </Lens>
                    <Guidance uuid=(guid1) key=(guid1)>
                        <ShortName>Bright mood</ShortName>
                        <Instructions>Emphasize light.</Instructions>
                        <Mark uuid=(mark1)><Match>Bright</Match></Mark>
                    </Guidance>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([result.schema])).toEqual(expectedWML)
    })

    it('excludes other top-level components (Feature, Knowledge, etc.) when subsetting by Room', () => {
        const inputWML = deIndentWML(`
            <Asset uuid=(test)>
                <Feature uuid=(f1) key=(fountain)>
                    <ShortName>Fountain</ShortName>
                </Feature>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Mark uuid=(mark1)><ShortName>Illumination</ShortName></Mark>
                    </Lens>
                    <Guidance uuid=(guid1) key=(guid1)>
                        <ShortName>Mood</ShortName>
                        <Instructions>Be descriptive.</Instructions>
                        <Mark uuid=(mark1)><Match>Clear</Match></Mark>
                    </Guidance>
                </Room>
                <Knowledge uuid=(k1) key=(lore)><ShortName>Lore</ShortName></Knowledge>
            </Asset>
        `)
        const form = new StandardForm(inputWML)
        const roomKey = new StandardKey({ key: 'room1', tag: 'Room' })
        const result = buildGenerationContextSubset(form, roomKey)
        const expectedWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Mark uuid=(mark1)><ShortName>Illumination</ShortName></Mark>
                    </Lens>
                    <Guidance uuid=(guid1) key=(guid1)>
                        <ShortName>Mood</ShortName>
                        <Instructions>Be descriptive.</Instructions>
                        <Mark uuid=(mark1)><Match>Clear</Match></Mark>
                    </Guidance>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([result.schema])).toEqual(expectedWML)
    })

    it('excludes Room Situation facets and other non-relevant Room content from the subset', () => {
        const inputWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                    <Situation key=(bright) ref={0}>
                        <DisplayName>Bright Lobby</DisplayName>
                    </Situation>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Mark uuid=(mark1)><ShortName>Illumination</ShortName></Mark>
                    </Lens>
                    <Guidance uuid=(guid1) key=(guid1)>
                        <ShortName>Bright mood</ShortName>
                        <Instructions>Mood is spooky, play up shadows.</Instructions>
                        <Mark uuid=(mark1)><Match>Bright</Match></Mark>
                    </Guidance>
                </Room>
            </Asset>
        `)
        const form = new StandardForm(inputWML)
        const roomKey = new StandardKey({ key: 'room1', tag: 'Room' })
        const result = buildGenerationContextSubset(form, roomKey)
        const expectedWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Mark uuid=(mark1)><ShortName>Illumination</ShortName></Mark>
                    </Lens>
                    <Guidance uuid=(guid1) key=(guid1)>
                        <ShortName>Bright mood</ShortName>
                        <Instructions>Mood is spooky, play up shadows.</Instructions>
                        <Mark uuid=(mark1)><Match>Bright</Match></Mark>
                    </Guidance>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([result.schema])).toEqual(expectedWML)
    })
})
