import Box from "@mui/material/Box"
import { FunctionComponent, useCallback, useMemo, useState } from "react"
import { Descendant, createEditor } from "slate"
import { withHistory } from "slate-history"
import { Editable, Slate, withReact } from "slate-react"
import { useDebouncedState } from "../../../hooks/useDebounce"
import wmlToSlate from "./wmlToSlate"
import SourceStream from "@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream"
import { expressionValueTokenizer } from "@tonylb/mtw-wml/dist/parser/tokenizer/expression"
import { sourceStringFromSlate } from "./wmlToSlate"

interface JSEditProps {
    src: string;
    onChange: (value: string) => void;
    maxHeight?: string;
    readonly?: boolean;
}

type SlateUnit = 'character' | 'word' | 'line' | 'block'
type Decoration = Range & { error: boolean }

export const isValidExpression = (value: string): boolean => {
    const sourceStream = new SourceStream(`{${value}}`)
    try {
        const expressionToken = expressionValueTokenizer(sourceStream)
        if (expressionToken && expressionToken.type === 'ExpressionValue' && expressionToken.value === value) {
            return true
        }
    }
    catch {}
    return false
}

const Leaf = ({ attributes, children, leaf }: { attributes: any, children: any, leaf: any }) => {
    return (
        <span
            {...attributes}
        >
            {children}
        </span>
    )
}

export const JSEdit: FunctionComponent<JSEditProps> = ({ src, onChange, maxHeight, readonly }) => {
    const [editor] = useState(() => withHistory(withReact(createEditor())))
    const renderLeaf = useCallback(props => (<Leaf { ...props } />), [])
    const debounceOnChange = useCallback((value) => {
        const src = sourceStringFromSlate(value)
        if (!readonly && isValidExpression(src)) {
            onChange(src)
        }
    }, [readonly])
    const [value, setValue] = useDebouncedState<Descendant[]>({
        value: wmlToSlate(src),
        delay: 500,
        onChange: debounceOnChange
    })
    const validExpression = useMemo(() => (isValidExpression(sourceStringFromSlate(value))), [value])

    return <Box sx={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
        <Box sx={{ maxHeight, margin: "0.25em", padding: "0.5em",  border: "1px solid", borderRadius: "0.5em", display: "flex", flexGrow: 1, overflow: "auto" }}>
            <Slate
                editor={editor}
                value={value}
                onChange={setValue}
            >
                <Editable
                    {...({ spellCheck: "false" } as any)}
                    renderLeaf={renderLeaf}
                    readOnly={readonly}
                />
            </Slate>
        </Box>
        <Box>
            { (!validExpression) && 'Invalid expression' }
        </Box>
    </Box>

}
