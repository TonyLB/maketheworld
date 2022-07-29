import { ParseTagFactory, ParseConditionTag, isParseTagDependency, ParseExitTag, ParseFeatureTag, ParseRoomTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseConditionFactory: ParseTagFactory<ParseConditionTag> = ({ open, context, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseConditionTag, 'dependencies'>>({
        open,
        endTagToken,
        required: {
            if: ['expression']
        }
    })
    const dependencies = contents.filter(isParseTagDependency)
    const nonDependencyContents = contents.filter((value) => (!isParseTagDependency(value)))
    const closestTag = context.length > 0 ? context[context.length - 1] : open
    switch(closestTag.tag) {
        //
        // TODO: Allow Conditions in different contexts, where they can allow different things (i.e., inside a
        // description context, allowing strings, links, etc.)
        //
        default:
            const parsedContents = validateContents<ParseExitTag | ParseFeatureTag | ParseRoomTag>({
                contents: nonDependencyContents,
                legalTags: ['Exit', 'Feature', 'Room'],
                ignoreTags: ['Whitespace', 'Comment']
            })
            return {
                type: 'Tag',
                tag: {
                    ...validate,
                    tag: 'Condition',
                    startTagToken: open.startTagToken,
                    endTagToken,
                    contents: parsedContents,
                    dependencies
                }
            }
    }
}

export default parseConditionFactory
