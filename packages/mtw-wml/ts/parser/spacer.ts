import { ParseTagFactory, ParseCommentTag, ParseSpacerTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseSpacerFactory: ParseTagFactory<ParseSpacerTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseSpacerTag, never>>({
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
            tag: 'Space',
            startTagToken: open.startTagToken,
            endTagToken
        }
    }    
}

export default parseSpacerFactory
