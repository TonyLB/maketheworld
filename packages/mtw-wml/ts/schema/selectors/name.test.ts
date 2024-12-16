import { schemaToWML, Schema } from ".."
import { deIndentWML } from "../utils"
import { selectName } from './name'
import { selectItemsByKey } from "./itemsByKey"
import { StandardForm } from '../../standardize'

describe('name selector', () => {
    it('should select a single key from a normalForm', () => {
        const test = new StandardForm(`
            <Asset key=(testOne)>
                <Room key=(room1)>
                    <Name>Test room</Name>
                    <Description>
                        TestZero
                    </Description>
                </Room>
                <Room key=(room2) />
                <If {true}>
                    <Room key=(room1)>
                        <Name>: Addendum</Name>
                    </Room>
                    <Room key=(room2)>
                        <Description>Red herring</Description>
                    </Room>
                </If>
                <Variable key=(testVar) default={false} />
            </Asset>
        `)
        expect(schemaToWML(selectName(selectItemsByKey('room1')([test.schema])))).toEqual(deIndentWML(`
            Test room
            <If {true}>: Addendum</If>
        `))
    })
})
