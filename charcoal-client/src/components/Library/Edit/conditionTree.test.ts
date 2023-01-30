import Normalizer from "@tonylb/mtw-wml/dist/normalize"
import { isNormalExit, NormalExit, NormalForm } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import parse from "@tonylb/mtw-wml/dist/parser"
import tokenizer from "@tonylb/mtw-wml/dist/parser/tokenizer"
import SourceStream from "@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream"
import { schemaFromParse } from "@tonylb/mtw-wml/dist/schema"
import { ConditionalTree, reduceItemsToTree } from "./conditionTree"

describe('conditionTree', () => {
    const reducer = (normalForm: NormalForm) => (reduceItemsToTree({ compare: (A: { key: string; name: string; }, B: { key: string; name: string; }): boolean => (A.key === B.key), normalForm, transform: ({ key, name }: NormalExit) => ({ key, name: name || '' }) }))
    const normalFromSource = (source: string) => {
        const normalizer = new Normalizer()
        const testCharacter = schemaFromParse(parse(tokenizer(new SourceStream(source))))
        normalizer.put(testCharacter[0], { contextStack: [], index: 0, replace: false })
        return normalizer.normal
    }

    it('should create nested elseIf items', () => {
        const testNormalForm = normalFromSource(`<Asset key=(test)>
            <Room key=(targetOne) />
            <Room key=(targetTwo) />
            <Room key=(targetThree) />
            <Room key=(targetFour) />
            <Variable key=(varOne) default={false} />
            <Variable key=(varTwo) default={false} />
            <Variable key=(varThree) default={false} />
            <Room key=(testRoom)>
                <If {varOne}>
                    <If {varTwo}>
                        <Exit to=(targetTwo)>target two</Exit>
                    </If>
                    <ElseIf {varThree}>
                        <Exit to=(targetThree)>target three</Exit>
                    </ElseIf>
                </If>
            </Room>
        </Asset>`)
        const testTree = Object.values(testNormalForm).filter(isNormalExit).reduce<ConditionalTree<{ key: string; name: string; }>>(reducer(testNormalForm), { items: [], conditionals: [] })
        expect(testTree).toMatchSnapshot()
    })

    it('should create complete tree given all exits', () => {
        const testNormalForm = normalFromSource(`<Asset key=(test)>
            <Room key=(targetOne) />
            <Room key=(targetTwo) />
            <Room key=(targetThree) />
            <Room key=(targetFour) />
            <Variable key=(varOne) default={false} />
            <Variable key=(varTwo) default={false} />
            <Variable key=(varThree) default={false} />
            <Room key=(testRoom)>
                <Exit to=(targetOne)>target one</Exit>
                <If {varOne}>
                    <If {varTwo}>
                        <Exit to=(targetTwo)>target two</Exit>
                    </If>
                    <ElseIf {varThree}>
                        <Exit to=(targetThree)>target three</Exit>
                    </ElseIf>
                    <Else>
                        <Exit to=(targetFour)>target four</Exit>
                    </Else>
                </If>
            </Room>
            <If {varOne}>
                <Room key=(targetOne)><Exit to=(testRoom)>fromOne</Exit></Room>
            </If>
            <Else>
                <Room key=(targetTwo)><Exit to=(testRoom)>fromTwo</Exit></Room>
            </Else>
        </Asset>`)
        const testTree = Object.values(testNormalForm).filter(isNormalExit).reduce<ConditionalTree<{ key: string; name: string; }>>(reducer(testNormalForm), { items: [], conditionals: [] })
        expect(testTree).toMatchSnapshot()
    })
})