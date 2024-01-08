import Normalizer from ".."
import { isSchemaCondition } from "../../simpleSchema/baseClasses"
import { selectDependencies } from './dependencies'

describe('dependencies selector', () => {
    it('should select dependencies from a room', () => {
        const testOne = new Normalizer()
        testOne.loadWML(`
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
        const setDependencies = (key: string, dependencies: string[]): void => {
            const findConditionDependencies = testOne._normalForm[key]?.appearances?.[0].data
            if (findConditionDependencies && isSchemaCondition(findConditionDependencies)) {
                findConditionDependencies.conditions[0].dependencies = dependencies
            }    
        }
        testOne.assignDependencies((src: string) => {
            switch(src) {
                case '!lights': return ['lights']
                case 'lights': return ['lights']
                case 'power': return ['power']
                default: return []
            }
        })
        console.log(`normal: ${JSON.stringify(testOne.normal, null, 4)}`)
        expect(testOne.select({ key: 'room1', selector: selectDependencies })).toEqual(['lights', 'power'])
    })

})
