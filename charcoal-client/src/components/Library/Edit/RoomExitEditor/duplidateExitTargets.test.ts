import { createEditor } from "slate"
import { CustomBlock } from "../baseClasses"
import duplicateExitTargets from "./duplicateExitTargets"

describe('duplicateExitTargets', () => {
    const slateExitTree: CustomBlock[] = [
        { key: 'TestB#TestA', type: 'exit', to: 'TestA', from: 'TestB', children: [{ text: 'ExitOne' }] },
        { key: 'TestD#TestC', type: 'exit', to: 'TestC', from: 'TestD', children: [{ text: 'ExitTwo' }] },
        { type: 'ifBase', source: "test", children: [
            { key: 'TestF#TestE', type: 'exit', to: 'TestE', from: 'TestF', children: [{ text: 'ExitThree' }] },
            { type: 'ifBase', source: "test", children: [
                { key: 'TestH#TestG', type: 'exit', to: 'TestG', from: 'TestH', children: [{ text: 'ExitFour' }] },    
            ]},
            { key: 'TestJ#TestI', type: 'exit', to: 'TestI', from: 'TestJ', children: [{ text: 'ExitFive' }] }
        ]},
        { type: 'else', children: [
            { key: 'TestL#TestK', type: 'exit', to: 'TestK', from: 'TestL', children: [{ text: 'ExitSix' }] }
        ]}
    ]
    const editor = createEditor()
    editor.children = slateExitTree

    it('should walk a conditional tree correctly', () => {
        expect(duplicateExitTargets(editor, [2, 1, 0], 'to')).toEqual(['TestE', 'TestC', 'TestA'])
        expect(duplicateExitTargets(editor, [2, 1, 0], 'from')).toEqual(['TestF', 'TestD', 'TestB'])
    })

    it('should ignore conditonal siblings', () => {
        expect(duplicateExitTargets(editor, [2, 2], 'to')).toEqual(['TestE', 'TestC', 'TestA'])
        expect(duplicateExitTargets(editor, [3, 0], 'to')).toEqual(['TestC', 'TestA'])
    })
})