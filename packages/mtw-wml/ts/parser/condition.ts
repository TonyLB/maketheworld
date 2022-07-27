import { ParseTagFactory, ParseConditionTag } from "./baseClasses"
import { validateProperties, ExtractProperties } from "./utils"

export const parseConditionFactory: ParseTagFactory<ParseConditionTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseConditionTag, 'dependencies'>>({
        open,
        endTagToken,
        required: {
            if: ['expression']
        }
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Condition',
            startTagToken: open.startTagToken,
            endTagToken,
            contents,
            dependencies: []
        }
    }    
}

export default parseConditionFactory
