import { schemaFromParse, schemaToWML } from ".."
import tokenizer from "../../parser/tokenizer"
import SourceStream from "../../parser/tokenizer/sourceStream"
import parse from "../../simpleParser"
import { deIndentWML } from "../utils"
import { convertToTree, deconvertFromTree } from './convert'

describe('schema tree converters', () => {
    describe('convertToTree', () => {
        const schemaTest = (wml: string) => (schemaFromParse(parse(tokenizer(new SourceStream(wml)))))
        it('should convert a simple tree', () => {
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
            expect(convertToTree(testOne)).toEqual([{
                data: { tag: 'Asset', key: 'test', contents: [] }, children: [
                    { data: { tag: 'Room', key: 'testRoomOne', render: [{ tag: 'String', value: 'Test description' }], name: [], contents: [] }, children: [
                        { data: { tag: 'Description', contents: [] }, children: [
                            { data: { tag: 'String', value: 'Test description' }, children: [] }
                        ]},
                        { data: { tag: 'Exit', from: 'testRoomOne', to: 'testRoomTwo', key: 'testRoomOne#testRoomTwo', name: 'out', contents: [] }, children: [
                            { data: { tag: 'String', value: 'out' }, children: [] }
                        ] }
                    ]},
                    { data: { tag: 'Room', key: 'testRoomTwo', render: [], name: [], contents: [] }, children: []}
                ]
            }])
        })
    })

    describe('deconvertFromTree', () => {
        const schemaTest = (wml: string) => (schemaFromParse(parse(tokenizer(new SourceStream(wml)))))
        it('should correctly round-trip a simple tree', () => {
            const testWML = `
                <Asset key=(test)>
                    <Room key=(testRoomOne)>
                        <Description>Test description</Description>
                        <Exit to=(testRoomTwo)>out</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
                </Asset>
            `
            const testOne = schemaTest(testWML)
            expect(schemaToWML(deconvertFromTree(convertToTree(testOne)))).toEqual(deIndentWML(testWML))
        })
    })
})
