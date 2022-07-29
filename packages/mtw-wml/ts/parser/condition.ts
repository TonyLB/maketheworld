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
    //
    // TODO: Map validateContents from different parseFactories into a central dispatcher that knows
    // about each of the different contents, and then use that dispatcher to map condition contents
    // within the context of their nearest wrapping parent.
    //
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
