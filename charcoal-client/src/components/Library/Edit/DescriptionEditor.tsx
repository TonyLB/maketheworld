import { FunctionComponent, useMemo, useState } from 'react'

import { useSlateStatic } from 'slate-react'
import { Descendant, createEditor, Editor, Node, Range, Text, Point } from 'slate'
import { withHistory } from 'slate-history'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'

import { RoomRenderItem } from '../../../wml/normalize'

interface DescriptionEditorProps {
    inheritedRender?: RoomRenderItem[];
    render: RoomRenderItem[];
}

const descendantsFromRender = (render: RoomRenderItem[]): Descendant[] => {
    const textRender = render.filter(value => (typeof value === 'string'))
    if (textRender.length > 0) {
        return [{
            type: 'line',
            children: textRender.map((text) => ({ text: text as string }))
        }]    
    }
    return []
}

export const DescriptionEditor: FunctionComponent<DescriptionEditorProps> = ({ inheritedRender = [], render }) => {
    const editor = useMemo(() => withHistory(withReact(createEditor())), [])
    const [value, setValue] = useState<Descendant[]>([
        ...descendantsFromRender(inheritedRender),
        ...descendantsFromRender(render)
    ])
    return <Slate editor={editor} value={value} onChange={value => { setValue(value) }}>
        <Editable />
    </Slate>
}

export default DescriptionEditor
