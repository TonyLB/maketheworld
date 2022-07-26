import { ParseTagFactory, ParseConditionTag } from "./baseClasses"
import { validateProperties, isValidateError, ExtractProperties } from "./utils"

export const parseConditionFactory: ParseTagFactory<ParseConditionTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseConditionTag, 'dependencies'>>({
        open,
        required: {
            if: ['expression']
        }
    })
    if (isValidateError(validate)) {
        return {
            type: 'Tag',
            tag: validate
        }
    }
    else {
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
}

export default parseConditionFactory
