import { splitMarkdownReasoningAndJson } from './splitMarkdownReasoningAndJson'

describe('splitMarkdownReasoningAndJson', () => {
    it('returns empty reasoning when body is JSON only', () => {
        const r = splitMarkdownReasoningAndJson('{"lines":[],"confidence":0.9}')
        expect(r).toEqual({
            ok: true,
            reasoningMarkdown: '',
            jsonText: '{"lines":[],"confidence":0.9}',
        })
    })

    it('uses trailing ```json fence: reasoning before fence, JSON from inner', () => {
        const body = `## Line 1
- Valid: shovel

\`\`\`json
{"lines":[{"valid":true,"name":"Shovel","affinities":[]}]}
\`\`\``
        const r = splitMarkdownReasoningAndJson(body)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.reasoningMarkdown).toContain('## Line 1')
            expect(r.reasoningMarkdown).not.toContain('```')
            expect(r.jsonText).toBe(
                '{"lines":[{"valid":true,"name":"Shovel","affinities":[]}]}'
            )
        }
    })

    it('uses last ```json fence when reasoning contains other fenced blocks', () => {
        const body = `\`\`\`text
scratch
\`\`\`

Notes.

\`\`\`json
{"x":1}
\`\`\``
        const r = splitMarkdownReasoningAndJson(body)
        expect(r).toEqual({
            ok: true,
            reasoningMarkdown: '```text\nscratch\n```\n\nNotes.',
            jsonText: '{"x":1}',
        })
    })

    it('handles JSON-only ```json fenced body (no reasoning)', () => {
        const body = `\`\`\`json
{"a":true}
\`\`\``
        const r = splitMarkdownReasoningAndJson(body)
        expect(r).toEqual({
            ok: true,
            reasoningMarkdown: '',
            jsonText: '{"a":true}',
        })
    })

    it('falls back to first brace to last brace when no trailing json fence', () => {
        const body = `Prose intro

{"type":"Unknown","confidence":1}`
        const r = splitMarkdownReasoningAndJson(body)
        expect(r).toEqual({
            ok: true,
            reasoningMarkdown: 'Prose intro',
            jsonText: '{"type":"Unknown","confidence":1}',
        })
    })

    it('strips full-body ```json fences in fallback path', () => {
        const body = `Prefix
\`\`\`json
{"k":"v"}
\`\`\`
Suffix ignored typically`
        const r = splitMarkdownReasoningAndJson(body)
        expect(r.ok).toBe(true)
        if (r.ok) {
            // Last-fence path: the body doesn't end in a fence, so the last ```json block is taken and
            // the suffix after it dropped.
            expect(r.jsonText).toBe('{"k":"v"}')
            expect(r.reasoningMarkdown).toBe('Prefix')
        }
    })

    it('takes the last json block when two are followed by prose (a draft block, then the full one)', () => {
        const body = `Steps:

\`\`\`json
{"steps": [{"says": "a"}]}
\`\`\`

Then the consequences.

\`\`\`json
{"steps": [{"says": "a", "consequences": []}]}
\`\`\`

This object breaks the step down.`
        expect(splitMarkdownReasoningAndJson(body)).toEqual({
            ok: true,
            reasoningMarkdown: 'Steps:\n\n```json\n{"steps": [{"says": "a"}]}\n```\n\nThen the consequences.',
            jsonText: '{"steps": [{"says": "a", "consequences": []}]}',
        })
    })

    it('takes an untagged fenced object followed by prose', () => {
        expect(splitMarkdownReasoningAndJson('R\n```\n{"a":1}\n```\nnote {b}')).toEqual({ ok: true, reasoningMarkdown: 'R', jsonText: '{"a":1}' })
    })

    it('skips a later fence in another language for the json block before it', () => {
        expect(splitMarkdownReasoningAndJson('R\n```json\n{"a":1}\n```\n```text\n{not json}\n```\nend')).toEqual({ ok: true, reasoningMarkdown: 'R', jsonText: '{"a":1}' })
    })

    it('falls back to the brace slice when no fence holds an object', () => {
        expect(splitMarkdownReasoningAndJson('R\n```json\nnot json\n```\n{"a":1}\nend')).toEqual({ ok: true, reasoningMarkdown: 'R\n```json\nnot json\n```', jsonText: '{"a":1}' })
    })

    it('ignores trailing prose after raw JSON when using brace fallback', () => {
        const body = `OK
{"a":1}
(trailing note)`
        const r = splitMarkdownReasoningAndJson(body)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.jsonText).toBe('{"a":1}')
            expect(r.reasoningMarkdown).toBe('OK')
        }
    })

    it('fails when there is no JSON object', () => {
        expect(splitMarkdownReasoningAndJson('just prose')).toEqual({
            ok: false,
            errorMessage: 'No JSON object found in model response',
        })
    })

    it('fails on empty string', () => {
        expect(splitMarkdownReasoningAndJson('')).toEqual({
            ok: false,
            errorMessage: 'Empty model response',
        })
    })

    it('fails when trailing fence is not valid JSON object', () => {
        const body = `## R
\`\`\`json
not json
\`\`\``
        expect(splitMarkdownReasoningAndJson(body)).toEqual({
            ok: false,
            errorMessage: 'Trailing fenced block did not contain a JSON object',
        })
    })
})
