import { ParseTagFactory, ParseComputedTag, ParseDependencyTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseComputedFactory: ParseTagFactory<ParseComputedTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseComputedTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key'],
            src: ['expression']
        }
    })
    const parseContents = validateContents<ParseDependencyTag>({
        contents,
        legalTags: ['Depend'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Computed',
            startTagToken: open.startTagToken,
            endTagToken,
            dependencies: parseContents
        }
    }    
}

export default parseComputedFactory
