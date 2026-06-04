import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import {
    situationIdToLabel,
    situationMarksToMarkState,
    situationToMarksSummary
} from './situationLabel'
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
        expect(aggregate).toBe('Untitled: Bright, Untitled: Cheerful')

        const noMarks = new StandardSituation({ tag: 'Situation', key: 'byKey' } as any)
        expect(situationToMarksSummary(noMarks, null)).toBe('byKey')

        const noMarksNoKey = new StandardSituation({ tag: 'Situation' } as any)
        expect(situationToMarksSummary(noMarksNoKey, null)).toBe('Situation')
    })

    it('situationIdToLabel should prefer Situation shortName when present', () => {
        const wml = deIndentWML(`
            <Asset uuid=(ASSET#test-asset)>
                <Situation key=(test) uuid=(SITUATION#test-situation-shortname)>
                    <ShortName>Stormy Night</ShortName>
                    <Mark uuid=(illumination_mark)><Match>Dark</Match></Mark>
                </Situation>
            </Asset>
        `)
        const form = new StandardForm(wml)
        const situation = form.components.find((c) => c instanceof StandardSituation) as StandardSituation
        const label = situationIdToLabel(situation.universalKey!, form)
        expect(label).toBe('Stormy Night')
    })

    it('situationIdToLabel should fall back to "Untitled (<aggregate-from-marks>)" when no shortName', () => {
        const wml = deIndentWML(`
            <Asset uuid=(ASSET#test-asset)>
                <Situation key=(test) uuid=(SITUATION#test-situation-aggregate)>
                    <Mark uuid=(illumination_mark)><Match>Dark</Match></Mark>
                    <Mark uuid=(mood_mark)><Match>Somber</Match></Mark>
                </Situation>
            </Asset>
        `)
        const form = new StandardForm(wml)
        const situation = form.components.find((c) => c instanceof StandardSituation) as StandardSituation
        const label = situationIdToLabel(situation.universalKey!, form)
        expect(label).toBe('Untitled (Untitled: Dark, Untitled: Somber)')
    })

    it('situationMarksToMarkState omits mark facets without universalKey', () => {
        const withMarks = new StandardSituation(deIndentWML(`
            <Situation key=(test) uuid=(SITUATION#s1)>
                <Mark uuid=(MARK#m1)><Match>bright</Match></Mark>
            </Situation>
        `))
        const state = situationMarksToMarkState(withMarks)
        expect(state.markValue).toEqual([{ mark: 'MARK#m1', value: 'bright' }])
    })

    it('situationIdToLabel should fall back to "Untitled (Situation)" when no marks or key and no shortName', () => {
        const wml = deIndentWML(`
            <Asset uuid=(ASSET#test-asset)>
                <Situation uuid=(SITUATION#test-situation-empty)>
                </Situation>
            </Asset>
        `)
        const form = new StandardForm(wml)
        const situation = form.components.find((c) => c instanceof StandardSituation) as StandardSituation
        const label = situationIdToLabel(situation.universalKey!, form)
        expect(label).toBe('Untitled (Situation)')
    })
})

