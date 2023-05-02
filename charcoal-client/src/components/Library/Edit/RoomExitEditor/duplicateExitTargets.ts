import { Editor, Element, Node, Path, path } from "slate";
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
        return !this._currentFocus
    }
    walk(): Node | undefined {
        if (!this._currentFocus) {
            return undefined
        }
        if (Path.hasPrevious(this._currentFocus)) {
            this._currentFocus = Path.previous(this._currentFocus)
            const [node] = Editor.node(this._editor, this._currentFocus)
            return node
        }
        if (this._currentFocus.length) {
            this._currentFocus = Path.parent(this._currentFocus)
            return this.walk()
        }
        this._currentFocus = undefined
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

export default duplicateExitTargets
