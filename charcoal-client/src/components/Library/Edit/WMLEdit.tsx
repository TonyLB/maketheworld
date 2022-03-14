import React, { FunctionComponent, useState } from 'react'
import { useSelector } from 'react-redux'
import { BaseEditor, Descendant, createEditor } from 'slate'
import { ReactEditor, Slate, Editable, withReact } from 'slate-react'

import {
    Box
} from '@mui/material'

import {
    getCurrentWML
} from '../../../slices/personalAssets'

interface WMLEditProps {
    AssetId: string;
}

type CustomElement = { type: 'paragraph'; children: CustomText[] }
type CustomText = { text: string }

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor
    Element: CustomElement
    Text: CustomText
  }
}
export const WMLEdit: FunctionComponent<WMLEditProps> = ({ AssetId }) => {
    const currentWML = useSelector(getCurrentWML(AssetId))
    const initialValue: CustomElement[] = [{
        type: 'paragraph',
        children: [{ text: currentWML }]
    }]
    const [editor] = useState(() => withReact(createEditor()))
    const [value, setValue] = useState<Descendant[]>(initialValue)
    return <Box sx={{ height: "100%", width: "100%" }}>
        <Box sx={{ margin: "0.25em", padding: "0.5em",  border: "1px solid", borderRadius: "0.5em" }}>
            <Slate
                editor={editor}
                value={value}
                onChange={newValue => setValue(newValue)}
            >
                <Editable {...({ spellCheck: "false" } as any)} />
            </Slate>
        </Box>
    </Box>
}

export default WMLEdit
