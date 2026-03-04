import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { situationIdToLabel, situationToMarksSummary } from './situationLabel'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('situation label helpers', () => {
    it('situationToMarksSummary should use marks and fall back to key/Situation', () => {
        const withMarks = new StandardSituation(deIndentWML(`
            <Situation key=(test)>
                <Mark uuid=(illumination_mark)><Match>Bright</Match></Mark>
                <Mark uuid=(mood_mark)><Match>Cheerful</Match></Mark>
            </Situation>
        `))
        const aggregate = situationToMarksSummary(withMarks, null)
        expect(aggregate).toBe('illumination_mark: Bright, mood_mark: Cheerful')

        const noMarks = new StandardSituation({ tag: 'Situation', key: 'byKey' } as any)
        expect(situationToMarksSummary(noMarks, null)).toBe('byKey')

        const noMarksNoKey = new StandardSituation({ tag: 'Situation' } as any)
        expect(situationToMarksSummary(noMarksNoKey, null)).toBe('Situation')
    })

    it('situationIdToLabel should prefer Situation shortName when present', () => {
        const situation = new StandardSituation(deIndentWML(`
            <Situation key=(test)>
                <ShortName>Stormy Night</ShortName>
                <Mark uuid=(illumination_mark)><Match>Dark</Match></Mark>
            </Situation>
        `))
        const form = new StandardForm([situation.toJSON()])
        const label = situationIdToLabel(situation.universalKey!, form)
        expect(label).toBe('Stormy Night')
    })

    it('situationIdToLabel should fall back to "Untitled (<aggregate-from-marks>)" when no shortName', () => {
        const situation = new StandardSituation(deIndentWML(`
            <Situation key=(test)>
                <Mark uuid=(illumination_mark)><Match>Dark</Match></Mark>
                <Mark uuid=(mood_mark)><Match>Somber</Match></Mark>
            </Situation>
        `))
        const form = new StandardForm([situation.toJSON()])
        const label = situationIdToLabel(situation.universalKey!, form)
        expect(label).toBe('Untitled (illumination_mark: Dark, mood_mark: Somber)')
    })

    it('situationIdToLabel should fall back to "Untitled (Situation)" when no marks or key and no shortName', () => {
        const situation = new StandardSituation({ tag: 'Situation' } as any)
        const form = new StandardForm([situation.toJSON()])
        const label = situationIdToLabel(situation.universalKey!, form)
        expect(label).toBe('Untitled (Situation)')
    })
})

