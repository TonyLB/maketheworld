import { ConverterMixinFactory, isTypedParseTagOpen } from "../functionMixins"
import { ParseTagFactory, ParseUseTag, ParseCommentTag, ParseException } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseUseFactory: ParseTagFactory<ParseUseTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseUseTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key']
        },
        optional: {
            as: ['key'],
            type: ['literal']
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
            tag: 'Use',
            startTagToken: open.startTagToken,
            endTagToken
        }
    }    
}

export const ParseUseMixin = ConverterMixinFactory({
    typeGuard: isTypedParseTagOpen('Use'),
    convert: ({ open, contents, endTagToken }) => {
        const validate = validateProperties<ExtractProperties<ParseUseTag, never>>({
            open,
            endTagToken,
            required: {
                key: ['key']
            },
            optional: {
                as: ['key'],
                type: ['literal']
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
                tag: 'Use',
                startTagToken: open.startTagToken,
                endTagToken
            }
        }    
    }
})

export default parseUseFactory
