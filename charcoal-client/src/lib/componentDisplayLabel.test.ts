import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { componentDisplayLabel } from './componentDisplayLabel'

describe('componentDisplayLabel', () => {
    describe('Character', () => {
        it('should prefer shortName when only shortName is set', () => {
            const wml = deIndentWML(`
                <Asset uuid=(ASSET#test)>
                    <Character key=(hero) uuid=(CHARACTER#hero)>
                        <ShortName>Tag Name</ShortName>
                    </Character>
                </Asset>
            `)
            const form = new StandardForm(wml)
            const character = form.components.find((c) => c instanceof StandardCharacter) as StandardCharacter
            expect(componentDisplayLabel(character)).toBe('Tag Name')
        })

        it('should use displayName when only displayName is set', () => {
            const wml = deIndentWML(`
                <Asset uuid=(ASSET#test)>
                    <Character key=(hero) uuid=(CHARACTER#hero)>
                        <DisplayName>In-World Name</DisplayName>
                    </Character>
                </Asset>
            `)
            const form = new StandardForm(wml)
            const character = form.components.find((c) => c instanceof StandardCharacter) as StandardCharacter
            expect(componentDisplayLabel(character)).toBe('In-World Name')
        })

        it('should prefer shortName over displayName when both are set', () => {
            const wml = deIndentWML(`
                <Asset uuid=(ASSET#test)>
                    <Character key=(hero) uuid=(CHARACTER#hero)>
                        <ShortName>Tag Name</ShortName>
                        <DisplayName>In-World Name</DisplayName>
                    </Character>
                </Asset>
            `)
            const form = new StandardForm(wml)
            const character = form.components.find((c) => c instanceof StandardCharacter) as StandardCharacter
            expect(componentDisplayLabel(character)).toBe('Tag Name')
        })

        it('should return undefined when neither shortName nor displayName nor key', () => {
            const character = new StandardCharacter({
                tag: 'Character',
                universalKey: 'CHARACTER#bare'
            } as any)
            expect(componentDisplayLabel(character)).toBeUndefined()
        })

        it('should fall back to key when includeKeyFallback and no names', () => {
            const character = new StandardCharacter({
                tag: 'Character',
                key: 'hero',
                universalKey: 'CHARACTER#hero'
            } as any)
            expect(componentDisplayLabel(character)).toBe('hero')
        })
    })

    describe('Situation', () => {
        it('should prefer shortName over marks-summary when both are present', () => {
            const wml = deIndentWML(`
                <Asset uuid=(ASSET#test)>
                    <Situation key=(storm) uuid=(SITUATION#storm)>
                        <ShortName>Stormy Night</ShortName>
                        <Mark uuid=(illumination_mark)><Match>Dark</Match></Mark>
                    </Situation>
                </Asset>
            `)
            const form = new StandardForm(wml)
            const situation = form.components.find((c) => c instanceof StandardSituation) as StandardSituation
            expect(componentDisplayLabel(situation, { standardForm: form })).toBe('Stormy Night')
        })

        it('should use situationIdToLabel aggregate when no shortName and no key', () => {
            const wml = deIndentWML(`
                <Asset uuid=(ASSET#test)>
                    <Situation uuid=(SITUATION#storm)>
                        <Mark uuid=(illumination_mark)><Match>Dark</Match></Mark>
                    </Situation>
                </Asset>
            `)
            const form = new StandardForm(wml)
            const situation = form.components.find((c) => c instanceof StandardSituation) as StandardSituation
            expect(componentDisplayLabel(situation, { standardForm: form })).toBe('Untitled (Untitled: Dark)')
        })
    })

    describe('Room', () => {
        it('should prefer shortName over key', () => {
            const wml = deIndentWML(`
                <Asset uuid=(ASSET#test)>
                    <Room key=(lobby) uuid=(ROOM#lobby)>
                        <ShortName>Main Lobby</ShortName>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(wml)
            const room = form.components.find((c) => c instanceof StandardRoom) as StandardRoom
            expect(componentDisplayLabel(room)).toBe('Main Lobby')
        })

        it('should fall back to key when no shortName', () => {
            const room = new StandardRoom({
                tag: 'Room',
                key: 'lobby',
                universalKey: 'ROOM#lobby'
            } as any)
            expect(componentDisplayLabel(room)).toBe('lobby')
        })
    })

    describe('options', () => {
        it('should skip key when includeKeyFallback is false', () => {
            const room = new StandardRoom({
                tag: 'Room',
                key: 'lobby',
                universalKey: 'ROOM#lobby'
            } as any)
            expect(componentDisplayLabel(room, { includeKeyFallback: false })).toBeUndefined()
        })

        it('should return fallbackLabel when chain is empty', () => {
            const room = new StandardRoom({
                tag: 'Room',
                universalKey: 'ROOM#bare'
            } as any)
            expect(componentDisplayLabel(room, { fallbackLabel: 'Untitled' })).toBe('Untitled')
        })

        it('should return undefined when chain is empty and no fallbackLabel', () => {
            const room = new StandardRoom({
                tag: 'Room',
                universalKey: 'ROOM#bare'
            } as any)
            expect(componentDisplayLabel(room)).toBeUndefined()
        })
    })
})
