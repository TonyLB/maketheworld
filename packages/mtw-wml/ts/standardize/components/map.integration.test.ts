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

    describe('schema output with shared references', () => {
            it('should round-trip Map with shared Feature between two Rooms via implicit parent', () => {
                //
                // Map with two Rooms (Position facets); each Room references the same Feature (all Direct refs).
                // SchemaOrganization assigns Feature's implicit parent to Map (common ancestor of the two Rooms).
                // Map has no Feature bucket, so Feature should render at Map level with ref={0} (Phase 2 Item 2).
                //
                const originalWML = deIndentWML(`
                    <Asset uuid=(Test)>
                        <Map uuid=(map1) key=(mapX)>
                            <ShortName>Map X</ShortName>
                            <Room uuid=(room1) key=(room1)>
                                <Position {0, 0} />
                                <ShortName>Room One</ShortName>
                                <Feature uuid=(feat1) key=(feat1)><ShortName>Shared Feature</ShortName></Feature>
                            </Room>
                            <Room uuid=(room2) key=(room2)>
                                <Position {100, 0} />
                                <ShortName>Room Two</ShortName>
                                <Feature uuid=(feat1) key=(feat1) />
                            </Room>
                        </Map>
                    </Asset>
                `)

                //
                // Step 1: Parse. Feature content is under Room One; Room Two references it.
                //
                const formFromOriginal = new StandardForm(originalWML)

                //
                // Step 2: Serialize. SchemaOrganization places Feature under Map (implicit parent).
                // Map has no Feature bucket; when Phase 2 Item 2 is done, Map will render Feature at Map level with ref={0}.
                //
                const implicitParentWML = deIndentWML(`
                    <Asset uuid=(Test)>
                        <Map uuid=(map1) key=(mapX)>
                            <ShortName>Map X</ShortName>
                            <Room uuid=(room1) key=(room1)>
                                <Position {0, 0} />
                                <ShortName>Room One</ShortName>
                                <Feature key=(feat1) />
                            </Room>
                            <Room uuid=(room2) key=(room2)>
                                <Position {100, 0} />
                                <ShortName>Room Two</ShortName>
                                <Feature key=(feat1) />
                            </Room>
                            <Feature uuid=(feat1) key=(feat1) ref={0}>
                                <ShortName>Shared Feature</ShortName>
                            </Feature>
                        </Map>
                    </Asset>
                `)
                expect(schemaToWML([formFromOriginal.schema])).toEqual(implicitParentWML)

                //
                // Step 3: Parse the implicit-parent WML and round-trip. Map accepts Feature as direct child (ref={0}) via StandardizeConsumerInline.
                //
                const formFromImplicitParent = new StandardForm(implicitParentWML)
                const roundTrippedWML = schemaToWML([formFromImplicitParent.schema])
                expect(roundTrippedWML).toEqual(implicitParentWML)
            })
    })
})
