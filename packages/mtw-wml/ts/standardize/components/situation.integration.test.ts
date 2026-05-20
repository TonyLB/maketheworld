import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import StandardSituation from './situation'
import StandardMark from './worldState'
import { StandardMarkFacet } from '../keys/facets/mark'
import StandardReference from '../keys/reference'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardSituation integration', () => {
    describe('Mark facets and ShortName', () => {
            it('should correctly round-trip a Situation with Mark facets', () => {
                const testWML = deIndentWML(`
                    <Asset uuid=(Test)>
                        <Mark uuid=(mark1) key=(mark1)>
                            <ShortName>Condition Mark</ShortName>
                            <Description>This is a condition mark.</Description>
                        </Mark>
                        <Situation uuid=(situation1) key=(situation1)>
                            <ShortName>Situation label</ShortName>
                            <Mark key=(mark1)><Match>Condition narrative</Match></Mark>
                        </Situation>
                    </Asset>
                `)
                const test = new StandardForm(testWML)
                expect(schemaToWML([test.schema])).toEqual(testWML)
                
                const mark = test.byUniversalId['MARK#mark1'] as StandardMark
                expect(mark).toBeDefined()
                expect(mark).toBeInstanceOf(StandardMark)
                
                const situation = test.byUniversalId['SITUATION#situation1'] as StandardSituation
                expect(situation).toBeDefined()
                expect(situation).toBeInstanceOf(StandardSituation)
                expect(situation.marks.length).toEqual(1)
                
                const facet = situation.marks.items[0] as StandardMarkFacet
                expect((facet.reference as StandardReference).key).toEqual('mark1')
                expect(facet.payload.toJSON()).toEqual('Condition narrative')
                expect(situation.shortName?.toJSON()).toEqual('Situation label')
            })

            it('should correctly parse Situation with ShortName and expose shortName', () => {
                const testWML = deIndentWML(`
                    <Asset uuid=(Test)>
                        <Situation uuid=(situation1) key=(situation1)>
                            <ShortName>Tab label</ShortName>
                        </Situation>
                    </Asset>
                `)
                const test = new StandardForm(testWML)
                const situation = test.byUniversalId['SITUATION#situation1'] as StandardSituation
                expect(situation).toBeDefined()
                expect(situation).toBeInstanceOf(StandardSituation)
                expect(situation.shortName?.toJSON()).toEqual('Tab label')
            })
    })

    describe('Nested facet edits via merge', () => {
            it('should allow nested Situation facet edits in edit mode', () => {
                const baseForm = new StandardForm(`<Asset uuid=(Test)>
                    <Room key=(testRoom)>
                        <Situation ref={0} uuid=(room-example)>
                            <DisplayName>Lobby</DisplayName>
                            <Description>A sterile corporate lobby.</Description>
                        </Situation>
                    </Room>
                </Asset>`)

                const editForm = new StandardForm(`<Asset uuid=(Test)>
                    <Room key=(testRoom) ref={0}>
                        <Situation uuid=(room-example) ref={0}>
                            <Replace><DisplayName>Lobby</DisplayName></Replace><With><DisplayName>Grand Foyer</DisplayName></With>
                        </Situation>
                    </Room>
                </Asset>`)

                const mergedForm = baseForm.merge(editForm)
                
                expect(schemaToWML([mergedForm.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room key=(testRoom)>
                            <Situation uuid=(room-example) ref={0}>
                                <DisplayName>Grand Foyer</DisplayName>
                                <Description>A sterile corporate lobby.</Description>
                            </Situation>
                        </Room>
                    </Asset>
                `))
            })
    })
})
