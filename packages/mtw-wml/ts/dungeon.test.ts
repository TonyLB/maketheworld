import * as fs from "fs"
import * as path from "path"

import parse from './parser'
import tokenize from './parser/tokenizer'
import SourceStream from "./parser/tokenizer/sourceStream"
import { schemaFromParse } from './schema'
import Normalizer from './normalize/'

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

    it('should normalize properly', () => {
        const normalizer = new Normalizer()
        schemaFromParse(parse(tokenize(new SourceStream(dungeonSource)))).forEach((schema, index) => {
            normalizer.put(schema, { contextStack: [], location: [index] })
        })
        expect(normalizer.normal).toMatchSnapshot()
    })
})