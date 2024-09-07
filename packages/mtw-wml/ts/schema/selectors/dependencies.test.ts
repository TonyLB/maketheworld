import { Schema } from ".."
import { selectDependencies } from './dependencies'
import { selectItemsByKey } from './itemsByKey'
import { Standardizer } from '../../standardize'
import { maybeGenericIDFromTree } from "../../tree/genericIDTree"

describe('dependencies selector', () => {
    it('should select dependencies from a room', () => {
        const testSchema = new Schema()
        testSchema.loadWML(`
            <Asset key=(testOne)>
                <Room key=(room1)>
                    <Name>Test room</Name>
                    <Description>
                        TestZero<If {!lights}>: at night</If>
                        <If {lights}>
                            TestOne
                        </If>
                        <ElseIf {power}>
                            TestTwo
                        </ElseIf>
                    </Description>
                </Room>
                <Variable key=(lights) default={true} />
                <Variable key=(power) default={true} />
            </Asset>
        `)
        const testOne = new Standardizer(testSchema.schema)
        testOne.assignDependencies((src: string) => {
            switch(src) {
                case '!lights': return ['lights']
                case 'lights': return ['lights']
                case 'power': return ['power']
                default: return []
            }
        })
        expect(selectDependencies(selectItemsByKey('room1')(maybeGenericIDFromTree(testOne.schema)))).toEqual(['lights', 'power'])
    })

})
