import { ParseTagFactory, ParseDependencyTag, ParseCommentTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseDependFactory: ParseTagFactory<ParseDependencyTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseDependencyTag, never>>({
        open,
        endTagToken,
        required: {
            on: ['key']
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
            tag: 'Depend',
            startTagToken: open.startTagToken,
            endTagToken
        }
    }    
}

export default parseDependFactory
