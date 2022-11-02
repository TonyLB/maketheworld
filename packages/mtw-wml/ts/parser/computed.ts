import { ParseTagFactory, ParseComputedTag, ParseDependencyTag, isParseTagDependency } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents, extractDependenciesFromJS } from "./utils"

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
        contents: contents.filter((item) => (!isParseTagDependency(item))),
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
            dependencies: extractDependenciesFromJS(validate.src)
        }
    }    
}

export default parseComputedFactory
