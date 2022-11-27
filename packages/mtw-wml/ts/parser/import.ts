import { ConverterMixinFactory, isTypedParseTagOpen } from "../convert/functionMixins"
import { ParseTagFactory, ParseImportTag, ParseImportLegalContents } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseImportFactory: ParseTagFactory<ParseImportTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseImportTag, never>>({
        open,
        endTagToken,
        required: {
            from: ['key']
        },
        optional: {}
    })
    const parseContents = validateContents<ParseImportLegalContents>({
        contents,
        legalTags: ['Use'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Import',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export const ParseImportMixin = ConverterMixinFactory({
    typeGuard: isTypedParseTagOpen('Import'),
    convert: ({ open, contents, endTagToken }) => {
        const validate = validateProperties<ExtractProperties<ParseImportTag, never>>({
            open,
            endTagToken,
            required: {
                from: ['key']
            },
            optional: {}
        })
        const parseContents = validateContents<ParseImportLegalContents>({
            contents,
            legalTags: ['Use'],
            ignoreTags: ['Whitespace', 'Comment']
        })
        return {
            type: 'Tag',
            tag: {
                ...validate,
                tag: 'Import',
                startTagToken: open.startTagToken,
                endTagToken,
                contents: parseContents
            }
        }    
    }
})

export default parseImportFactory
