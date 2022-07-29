import { ParseTagFactory, ParseAssetTag, ParseActionTag, ParseComputedTag, ParseException, ParseExitTag, ParseFeatureTag, ParseImportTag, ParseRoomTag, ParseVariableTag, ParseConditionTag } from "./baseClasses"
import { validateProperties, validateContents, ExtractProperties } from "./utils"

export const parseAssetFactory: ParseTagFactory<ParseAssetTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseAssetTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key']
        },
        optional: {
            fileName: ['literal'],
            zone: ['literal'],
            subFolder: ['literal'],
            player: ['literal']
        }
    })
    const parseContents = validateContents<ParseActionTag | ParseComputedTag | ParseConditionTag | ParseExitTag | ParseFeatureTag | ParseImportTag | ParseRoomTag | ParseVariableTag>({
        contents,
        legalTags: ['Action', 'Computed', 'Condition', 'Exit', 'Feature', 'Import', 'Room', 'Variable'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Asset',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export default parseAssetFactory