import Box from "@mui/material/Box"
import { FunctionComponent, useCallback, useState } from "react"
import { Descendant, createEditor } from "slate"
import { withHistory } from "slate-history"
import { Editable, Slate, withReact } from "slate-react"
import { useDebouncedState } from "../../../hooks/useDebounce"

interface JSEditProps {}

type SlateUnit = 'character' | 'word' | 'line' | 'block'
type Decoration = Range & { error: boolean }

const Leaf = ({ attributes, children, leaf }: { attributes: any, children: any, leaf: any }) => {
    return (
        <span
            {...attributes}
        >
            {children}
        </span>
    )
}

export const JSEdit: FunctionComponent<JSEditProps> = () => {
    const [editor] = useState(() => withHistory(withReact(createEditor())))
    const renderLeaf = useCallback(props => (<Leaf { ...props } />), [])
    const [value, setValue] = useDebouncedState<Descendant[]>({ value: [{ type: 'line', children: [{ text: 'false' }] }], delay: 500, onChange: () => {} })

    return <Box sx={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
        <Box sx={{ margin: "0.25em", padding: "0.5em",  border: "1px solid", borderRadius: "0.5em", display: "flex", flexGrow: 1, overflow: "auto" }}>
            <Slate
                editor={editor}
                value={value}
                // onChange={setValue}
            >
                <Editable
                    {...({ spellCheck: "false" } as any)}
                    renderLeaf={renderLeaf}
                    readOnly
                />
            </Slate>
        </Box>
        <Box>
            statusMessage
        </Box>
    </Box>

}
