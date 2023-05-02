import { Editor, Element, Node, Path } from "slate";
import { CustomExitBlock } from "../baseClasses";
import { unique } from "../../../../lib/lists";
import { isCustomExitBlock } from "../baseClasses";
import { isCustomBlock } from "../baseClasses";

export class ExitTreeWalker {
    _editor: Editor;
    _currentFocus: Path | undefined;
    _currentLevel: Path | undefined;
    constructor(editor: Editor, path: Path) {
        this._editor = editor
        this._currentFocus = path
        this._currentLevel = Editor.above(editor, { at: path })?.[1]
    }
    get isComplete(): boolean {
        return typeof this._currentFocus === undefined
    }
    walk(): Node | undefined {
        if (!this._currentFocus) {
            return undefined
        }
        let next = Editor.before(this._editor, this._currentFocus, { unit: 'block' })
        while(!next) {
            const currentLevel = this._currentLevel
            if (currentLevel) {
                this._currentFocus = currentLevel
                const [_, above] = Editor.above(this._editor, { at: currentLevel })
                this._currentLevel = above
                let next = Editor.before(this._editor, this._currentFocus, { unit: 'block' })
                continue
            }
            break
        }
        if (next) {
            this._currentFocus = next.path
            const [node] = Editor.node(this._editor, next)
            return node
        }
        return undefined
    }
}

export const duplicateExitTargets = (editor: Editor, path: Path, key: 'to' | 'from'): string[] => {
    let accumulator: string[] = []
    const exitWalker = new ExitTreeWalker(editor, path)
    while(!exitWalker.isComplete) {
        const node = exitWalker.walk()
        if (node && !Editor.isEditor(node) && Element.isElement(node) && isCustomBlock(node) && isCustomExitBlock(node)) {
            const newValue = node[key]
            accumulator = [...accumulator, newValue]
        }
    }
    return unique(accumulator) as string[]
}