import { ParseTagFactory, ParseAssetTag, ParseStoryTag, ParseActionTag, ParseComputedTag, ParseExitTag, ParseFeatureTag, ParseImportTag, ParseRoomTag, ParseVariableTag, ParseConditionTag, ParseMapTag } from "./baseClasses"
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
    const parseContents = validateContents<ParseActionTag | ParseComputedTag | ParseConditionTag | ParseExitTag | ParseFeatureTag | ParseImportTag | ParseRoomTag | ParseMapTag | ParseVariableTag>({
        contents,
        legalTags: ['Action', 'Computed', 'Condition', 'Exit', 'Feature', 'Import', 'Room', 'Variable', 'Map'],
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

export const parseStoryFactory: ParseTagFactory<ParseStoryTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseStoryTag, never>>({
        open,
        endTagToken,
        required: {
            key: ['key']
        },
        optional: {
            fileName: ['literal'],
            zone: ['literal'],
            subFolder: ['literal'],
            player: ['literal'],
            instance: ['boolean']
        }
    })
    const parseContents = validateContents<ParseActionTag | ParseComputedTag | ParseConditionTag | ParseExitTag | ParseFeatureTag | ParseImportTag | ParseRoomTag | ParseMapTag | ParseVariableTag>({
        contents,
        legalTags: ['Action', 'Computed', 'Condition', 'Exit', 'Feature', 'Import', 'Room', 'Variable', 'Map'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Story',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export default parseAssetFactory