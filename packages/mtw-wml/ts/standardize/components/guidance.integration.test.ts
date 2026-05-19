import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardGuidance integration', () => {
    describe('Guidance facet round-trip (WML -> StandardForm -> WML)', () => {
        it('should not emit Mark at top level when Guidance has a Mark facet with Match value', () => {
            const wml = deIndentWML(`
                <Asset uuid=(asset-id)>
                    <Guidance uuid=(guidance-id) ref={0}>
                        <Mark uuid=(mark-id) ref={0}><Match>Dark</Match></Mark>
                    </Guidance>
                </Asset>
            `)
            const standardForm = new StandardForm(wml)
            const roundTripWML = schemaToWML([standardForm.schema])

            expect(roundTripWML).toEqual(wml)
        })
    })
})
