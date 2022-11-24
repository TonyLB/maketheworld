import { ConverterMixinFactory, isTypedParseTagOpen } from "../functionMixins"
import { ParseTagFactory, ParseLineBreakTag, ParseCommentTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseLineBreakFactory: ParseTagFactory<ParseLineBreakTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseLineBreakTag, never>>({
        open,
        endTagToken,
        required: {},
        optional: {}
    })
    validateContents<ParseCommentTag>({
        contents,
        legalTags: [],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'br',
            startTagToken: open.startTagToken,
            endTagToken
        }
    }    
}

export const ParseLineBreakMixin = ConverterMixinFactory({
    typeGuard: isTypedParseTagOpen('br'),
    convert: ({ open, contents, endTagToken }) => {
        const validate = validateProperties<ExtractProperties<ParseLineBreakTag, never>>({
            open,
            endTagToken,
            required: {},
            optional: {}
        })
        validateContents<ParseCommentTag>({
            contents,
            legalTags: [],
            ignoreTags: ['Whitespace', 'Comment']
        })
        return {
            type: 'Tag',
            tag: {
                ...validate,
                tag: 'br',
                startTagToken: open.startTagToken,
                endTagToken
            }
        }    
    }
})
    
export default parseLineBreakFactory
