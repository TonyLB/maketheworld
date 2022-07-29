import { ParseTagFactory, ParseVariableTag, ParseCommentTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseVariableFactory: ParseTagFactory<ParseVariableTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseVariableTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key']
        },
        optional: {
            default: ['expression']
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
            tag: 'Variable',
            startTagToken: open.startTagToken,
            endTagToken
        }
    }    
}

export default parseVariableFactory
