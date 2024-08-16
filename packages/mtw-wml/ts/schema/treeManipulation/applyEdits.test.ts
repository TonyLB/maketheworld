import { schemaFromParse, schemaToWML } from '..'
import tokenizer from '../../parser/tokenizer'
import SourceStream from '../../parser/tokenizer/sourceStream'
import parse from '../../simpleParser'
import { maybeGenericIDFromTree } from '../../tree/genericIDTree'
import { deIndentWML } from '../utils'

import applyEdits from './applyEdits'

describe('applyEdits', () => {
    const schemaTest = (wml: string) => (maybeGenericIDFromTree(schemaFromParse(parse(tokenizer(new SourceStream(wml))))))

    it('should leave non-edit syntax untouched', () => {
        const testOne = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Description>Test description</Description>
                    <Exit to=(testRoomTwo)>out</Exit>
                </Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        expect(applyEdits(testOne)).toEqual(testOne)
    })

    it('should apply replace that matches present content', () => {
        const test = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Description>Test description</Description>
                    <Replace><Description>Test description</Description></Replace>
                    <With><Description>New test</Description></With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(applyEdits(test))).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(testRoomOne)><Description>New test</Description></Room>
            </Asset>
        `))
    })

    it('should apply replace that exceeds present content', () => {
        const test = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Description>description</Description>
                    <Replace><Description>Test description</Description></Replace>
                    <With><Description>New test</Description></With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(applyEdits(test))).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Replace><Description>Test<space /></Description></Replace>
                    <With><Description>New test</Description></With>
                </Room>
            </Asset>
        `))
    })

    it('should no-op an add combined with a matching remove', () => {
        const test = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Description>Test description</Description>
                    <Remove><Description>Test description</Description></Remove>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(applyEdits(test))).toEqual(deIndentWML(`
            <Asset key=(test)><Room key=(testRoomOne) /></Asset>
        `))
    })

})