import * as fs from "fs"
import * as path from "path"

import parse from './simpleParser'
import tokenize from './parser/tokenizer'
import SourceStream from "./parser/tokenizer/sourceStream"
import { StandardForm } from "./standardize"
const file = path.join(__dirname, "./", "dungeon.wml")

const dungeonSource = fs.readFileSync(file, "utf8")

describe('large WML test', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should parse properly', () => {
        expect(parse(tokenize(new SourceStream(dungeonSource)))).toMatchSnapshot()
    })

    it('should standardize properly', () => {
        const standard = new StandardForm(dungeonSource)
        expect(standard.toJSON({ stripUIFields: true, stripUniversalKey: true }).components).toMatchSnapshot()
    })
})