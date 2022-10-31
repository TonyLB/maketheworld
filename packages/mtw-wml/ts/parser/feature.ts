import { ParseTagFactory, ParseFeatureTag, ParseFeatureLegalContents } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseFeatureFactory: ParseTagFactory<ParseFeatureTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseFeatureTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key']
        },
        optional: {
            global: ['boolean']
        }
    })
    const parseContents = validateContents<ParseFeatureLegalContents>({
        contents,
        legalTags: ['Name', 'Description', 'If'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Feature',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export default parseFeatureFactory
