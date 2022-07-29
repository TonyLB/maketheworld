import { ParseTagFactory, ParseUseTag, ParseImportTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseImportFactory: ParseTagFactory<ParseImportTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseImportTag, never>>({
        open,
        endTagToken,
        required: {
            from: ['key']
        },
        optional: {}
    })
    const parseContents = validateContents<ParseUseTag>({
        contents,
        legalTags: ['Use'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Import',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export default parseImportFactory
