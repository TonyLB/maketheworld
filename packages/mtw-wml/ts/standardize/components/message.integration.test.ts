import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardMessage integration', () => {
    describe('Schema render', () => {
            it('should render messages correctly', () => {
                const test = new StandardForm(`<Asset uuid=(Test)>
                    <Message uuid=(testMessage) key=(testMessage)>
                        <Description>Test message</Description>
                        <Room uuid=(testRoomOne) key=(testRoomOne)>
                            <Situation ref={0} uuid=(testRoomOneBase)>
                                <Description>Test Room One</Description>
                            </Situation>
                            <Exit to=(testRoomTwo)>two</Exit>
                        </Room>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                            <Situation ref={0} uuid=(testRoomTwoBase)>
                                <Description>Test Room Two</Description>
                            </Situation>
                            <Exit to=(testRoomOne)>one</Exit>
                        </Room>
                    </Message>
                    <Room uuid=(testRoomOne) />
                    <Room uuid=(testRoomTwo) />
                </Asset>`)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne)>
                            <Situation uuid=(testRoomOneBase) ref={0}>
                                <Description>Test Room One</Description>
                            </Situation>
                            <Exit to=(testRoomTwo)>two</Exit>
                        </Room>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                            <Situation uuid=(testRoomTwoBase) ref={0}>
                                <Description>Test Room Two</Description>
                            </Situation>
                            <Exit to=(testRoomOne)>one</Exit>
                        </Room>
                        <Message uuid=(testMessage) key=(testMessage)>
                            <Room key=(testRoomOne) />
                            <Room key=(testRoomTwo) />
                            <Description>Test message</Description>
                        </Message>
                        <Situation uuid=(testRoomOneBase) ref={0} />
                        <Situation uuid=(testRoomTwoBase) ref={0} />
                    </Asset>
                `))
            })
    })
})
