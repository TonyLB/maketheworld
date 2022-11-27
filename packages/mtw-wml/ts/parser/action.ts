import { ConverterMixinFactory, isTypedParseTagOpen } from "../convert/functionMixins"
import { ParseTagFactory, ParseActionTag, ParseCommentTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseActionFactory: ParseTagFactory<ParseActionTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseActionTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key'],
            src: ['expression']
        }
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
            tag: 'Action',
            startTagToken: open.startTagToken,
            endTagToken
        }
    }    
}

export const ParseActionMixin = ConverterMixinFactory({
    typeGuard: isTypedParseTagOpen('Action'),
    convert: ({ open, contents, endTagToken }) => {
        const validate = validateProperties<ExtractProperties<ParseActionTag, never>>({
            open,
            endTagToken,
            required: {
                key: ['key'],
                src: ['expression']
            }
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
                tag: 'Action',
                startTagToken: open.startTagToken,
                endTagToken
            }
        }    
    }
})

export default parseActionFactory
