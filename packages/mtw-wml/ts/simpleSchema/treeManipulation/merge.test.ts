import { schemaFromParse, schemaToWML } from '..'
import tokenizer from '../../parser/tokenizer'
import SourceStream from '../../parser/tokenizer/sourceStream'
import parse from '../../simpleParser'
import mergeSchemaTrees from './merge'
import { deIndentWML } from '../utils'

describe('mergeSchemaTrees', () => {
    const schemaTest = (wml: string) => (schemaFromParse(parse(tokenizer(new SourceStream(wml)))))

    it('should merge two simple trees', () => {
        const testOne = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Description>
                        Test description
                    </Description>
                    <Exit to=(testRoomTwo)>out</Exit>
                </Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        const testTwo = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne) />
                <Room key=(testRoomTwo)>
                    <Description>
                        The other test description
                    </Description>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(mergeSchemaTrees(testOne, testTwo))).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Description>
                        Test description
                    </Description>
                    <Exit to=(testRoomTwo)>out</Exit>
                </Room>
                <Room key=(testRoomTwo)>
                    <Description>
                        The other test description
                    </Description>
                </Room>
            </Asset>
        `))
    })
})