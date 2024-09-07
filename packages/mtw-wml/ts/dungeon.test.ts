import * as fs from "fs"
import * as path from "path"

import parse from './simpleParser'
import tokenize from './parser/tokenizer'
import SourceStream from "./parser/tokenizer/sourceStream"
import { Standardizer } from "./standardize"
import { Schema } from "./schema"
import { stripIDFromTree } from "./tree/genericIDTree"
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
        const schema = new Schema()
        schema.loadWML(dungeonSource)
        const standardizer = new Standardizer(stripIDFromTree(schema.schema))
        expect(standardizer.stripped.byId).toMatchSnapshot()
    })
})