import { ParseTagFactory, ParseComputedTag } from "./baseClasses"
import { validateProperties, ExtractProperties, extractDependenciesFromJS } from "./utils"

export const parseComputedFactory: ParseTagFactory<ParseComputedTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseComputedTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key'],
            src: ['expression']
        }
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
