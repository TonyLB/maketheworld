import { ParseTagFactory, ParseImageTag, ParseCommentTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseImageFactory: ParseTagFactory<ParseImageTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseImageTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key']
        },
        optional: {
            fileURL: ['literal']
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
            tag: 'Image',
            startTagToken: open.startTagToken,
            endTagToken
        }
    }    
}

export default parseImageFactory
