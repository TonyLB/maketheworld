import { ParseTagFactory, ParseAssetTag } from "./baseClasses"
import { isTokenKeyValue } from "./tokenizer/baseClasses"

export const parseAssetFactory: ParseTagFactory<ParseAssetTag> = ({ open, contents, endTagToken }) => {
    if (open.properties.key && isTokenKeyValue(open.properties.key)) {
        return {
            type: 'Tag',
            tag: {
                tag: 'Asset',
                startTagToken: open.startTagToken,
                endTagToken,
                key: open.properties.key.value,
                contents
            }
        }    
    }
    else {
        return {
            type: 'Tag',
            tag: {
                tag: 'Error',
                startTagToken: open.startTagToken,
                endTagToken,
                message: 'Key must be specified for Asset',
            }
        }
    }
}