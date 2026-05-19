import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardMap integration', () => {
    describe('Schema render', () => {
            it('should render maps correctly', () => {
                const test = new StandardForm(`<Asset uuid=(Test)>
                    <Map uuid=(testMap) key=(testMap)>
                        <ShortName>Test map</ShortName>
                        <Room uuid=(testRoomOne) key=(testRoomOne)>
                            <Position {0, 0} />
                            <Situation ref={0} uuid=(testRoomOneBase)>
                                <Description>Test Room One</Description>
                            </Situation>
                            <Exit to=(testRoomTwo)>two</Exit>
                        </Room>
                        <Room uuid=(testRoomOne) key=(testRoomOne) />
                        <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                            <Position {-100, 0} />
                            <Situation ref={0} uuid=(testRoomTwoBase)>
                                <Description>Test Room Two</Description>
                            </Situation>
                            <Exit to=(testRoomOne)>one</Exit>
                        </Room>
                        <Room uuid=(testRoomThree) key=(testRoomThree) />
                        <Image key=(mapBackground) />
                    </Map>
                    <Room uuid=(testRoomOne) />
                    <Room uuid=(testRoomTwo) />
                    <Room uuid=(testRoomThree) />
                </Asset>`)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne)>
                            <Situation uuid=(testRoomOneBase) ref={0}>
                                <Description>Test Room One</Description>
                            </Situation>
                            <Exit to=(testRoomTwo)>two</Exit>
                        </Room>
                        <Room uuid=(testRoomThree) key=(testRoomThree) />
                        <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                            <Situation uuid=(testRoomTwoBase) ref={0}>
                                <Description>Test Room Two</Description>
                            </Situation>
                            <Exit to=(testRoomOne)>one</Exit>
                        </Room>
                        <Map uuid=(testMap) key=(testMap)>
                            <ShortName>Test map</ShortName>
                            <Image key=(mapBackground) />
                            <Room key=(testRoomOne)><Position {0, 0} /></Room>
                            <Room key=(testRoomTwo)><Position {-100, 0} /></Room>
                        </Map>
                        <Situation uuid=(testRoomOneBase) ref={0} />
                        <Situation uuid=(testRoomTwoBase) ref={0} />
                    </Asset>
                `))
            })

            it('should render empty maps', () => {
                const test = new StandardForm(`<Asset uuid=(Test)><Map uuid=(testMap) key=(testMap) /></Asset>`)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)><Map uuid=(testMap) key=(testMap) /></Asset>
                `))
            })
    })
})
