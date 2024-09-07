import { Standardizer } from '../../standardize'
import { schemaToWML, Schema } from ".."
import { deIndentWML } from "../utils"
import { selectName } from './name'
import { selectItemsByKey } from "./itemsByKey"
import { maybeGenericIDFromTree } from '../../tree/genericIDTree'

describe('name selector', () => {
    it('should select a single key from a normalForm', () => {
        const testSchema = new Schema()
        testSchema.loadWML(`
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
        const testOne = new Standardizer(testSchema.schema)
        expect(schemaToWML(selectName(selectItemsByKey('room1')(maybeGenericIDFromTree(testOne.schema))))).toEqual(deIndentWML(`
            Test room
            <If {true}>: Addendum</If>
        `))
    })
})
