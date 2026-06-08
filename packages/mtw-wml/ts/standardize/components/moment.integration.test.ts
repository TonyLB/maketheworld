import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardMoment integration', () => {
    describe('Schema render', () => {
            it('should render moments correctly', () => {
                const test = new StandardForm(`<Asset uuid=(Test)>
                    <Moment uuid=(testMoment) key=(testMoment)>
                        <Message uuid=(testMessage) key=(testMessage)>
                            <Description>Test message</Description>
                            <Room uuid=(testRoomOne) key=(testRoomOne)>
                                <Situation ref={0} uuid=(testRoomOneBase)>
                                    <Description>Test Room One</Description>
                                </Situation>
                            </Room>
                        </Message>
                    </Moment>
                    <Room uuid=(testRoomOne) />
                    <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                </Asset>`)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoomOne) key=(testRoomOne)>
                            <Situation uuid=(testRoomOneBase) ref={0}>
                                <Description>Test Room One</Description>
                            </Situation>
                        </Room>
                        <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                        <Moment uuid=(testMoment) key=(testMoment)>
                            <Message uuid=(testMessage) key=(testMessage)>
                                <Room key=(testRoomOne) />
                                <Description>Test message</Description>
                            </Message>
                        </Moment>
                        <Situation uuid=(testRoomOneBase) ref={0} />
                    </Asset>
                `))
            })
    })
})
