import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import StandardArea from './area'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardArea integration', () => {
    describe('Schema render', () => {
        it('should render top-level Area with heterogeneous positionGraph children', () => {
            const test = new StandardForm(`<Asset uuid=(Test)>
                <Area uuid=(downtown) key=(downtown)>
                    <ShortName>Downtown</ShortName>
                    <Area key=(oldTown) />
                    <Room key=(cafe) />
                    <Feature key=(fountain) />
                    <Character key=(guard) />
                </Area>
            </Asset>`)
            expect(test.byUniversalId['AREA#downtown']).toBeInstanceOf(StandardArea)
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Area uuid=(downtown) key=(downtown)>
                        <ShortName>Downtown</ShortName>
                        <Room key=(cafe) />
                        <Feature key=(fountain) />
                        <Character key=(guard) />
                        <Area key=(oldTown) />
                    </Area>
                </Asset>
            `))
        })

        it('should render empty Area without positionGraph wrapper', () => {
            const test = new StandardForm(`<Asset uuid=(Test)><Area uuid=(empty) key=(empty) /></Asset>`)
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)><Area uuid=(empty) key=(empty) /></Asset>
            `))
        })

        it('should render Area with portal edge (participant endpoint rule)', () => {
            const test = new StandardForm(`<Asset uuid=(Test)>
                <Area uuid=(region) key=(region)>
                    <Room key=(highway) />
                    <Exit uuid=(e1)>
                        <From>highway</From>
                        <To>outsideRoom</To>
                        <Forward>east</Forward>
                        <Back>west</Back>
                    </Exit>
                </Area>
                <Room key=(outsideRoom)><ShortName>Outside</ShortName></Room>
            </Asset>`)
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(outsideRoom)><ShortName>Outside</ShortName></Room>
                    <Area uuid=(region) key=(region)>
                        <Room key=(highway) />
                        <Exit uuid=(e1)>
                            <From>highway</From>
                            <To>outsideRoom</To>
                            <Forward>east</Forward>
                            <Back>west</Back>
                        </Exit>
                    </Area>
                </Asset>
            `))
        })

        it('should reject Area edge with neither endpoint in nodes (participant endpoint rule)', () => {
            expect(() => new StandardForm(`<Asset uuid=(Test)>
                <Area uuid=(region) key=(region)>
                    <Room key=(unrelated) />
                    <Exit uuid=(e1)>
                        <From>highway</From>
                        <To>townCenter</To>
                    </Exit>
                </Area>
            </Asset>`)).toThrow(/requires at least one endpoint in positionGraph.nodes/)
        })
    })
})
