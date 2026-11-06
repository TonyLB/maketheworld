import type { JudgeRequest } from '../../dataSource/positions/ludicCache/sceneFixtures'
import { JUDGE_INSTRUCTIONS } from '../../dataSource/actions/sceneProse/frame'
import { gradeJudgeReply, judgeReplySteps, summarizeJudge, type JudgeCall } from './judgeGrade'

const reply = (answer: string, middle = ['Mentions: [teapot1] established.', 'Picture: The teapot stays.', 'Rules: none', 'Obstacle: [teapot1] is glued to [table1].', 'Needs: nothing', 'Revises (if it happens): nothing', 'Tests: obstructed (2): yes']) => [...middle, `Answer: ${answer}`].join('\n')

const teapot: JudgeRequest = {
    request: 'I want to pick up [teapot1].', expect: 'obstructed', tolerate: ['contingent'], mentions: ['glue'], avoids: ['unglue', 'pry'],
}

describe('judgeReplySteps', () => {
    it('reads the numbered steps of the instructions', () => {
        expect(judgeReplySteps(JUDGE_INSTRUCTIONS)).toEqual(['mentions', 'picture', 'rules', 'obstacle', 'needs', 'revises', 'tests', 'answer'])
        expect(judgeReplySteps('1. Picture: a\n- "x": b\n2. Rules: c\n3. Revises (if it happens): d\n4. Answer: e')).toEqual(['picture', 'rules', 'revises', 'answer'])
    })
})

describe('gradeJudgeReply', () => {
    it('passes the expected label, and a tolerated label as a border case', () => {
        expect(gradeJudgeReply(teapot, reply('obstructed [teapot1] is glued to [table1].')).verdict).toBe('pass')
        expect(gradeJudgeReply(teapot, reply('contingent a tool.')).verdict).toBe('border')
    })

    it('fails any other label, and a reply with no label', () => {
        expect(gradeJudgeReply(teapot, reply('impossible nope.')).verdict).toBe('failure')
        expect(gradeJudgeReply(teapot, 'I cannot say.').verdict).toBe('failure')
        expect(gradeJudgeReply(teapot, 'I cannot say.').label).toBeUndefined()
    })

    it('reads confusing as a label, and fails it', () => {
        expect(gradeJudgeReply(teapot, reply('confusing nothing fits.'))).toMatchObject({ verdict: 'failure', label: 'confusing', wrongSimple: false })
    })

    it('never tolerates a wrong simple, even when listed', () => {
        const grade = gradeJudgeReply({ ...teapot, tolerate: ['simple'] }, reply('simple'))
        expect(grade.verdict).toBe('failure')
        expect(grade.wrongSimple).toBe(true)
        expect(gradeJudgeReply({ request: 'x', expect: 'simple' }, reply('simple')).wrongSimple).toBe(false)
    })

    it('reads the form: missing steps and order', () => {
        expect(gradeJudgeReply(teapot, reply('obstructed glue.')).form).toEqual({ missing: [], inOrder: true })
        expect(gradeJudgeReply(teapot, 'Answer: obstructed glue.').form).toEqual({ missing: ['mentions', 'picture', 'rules', 'obstacle', 'needs', 'revises', 'tests'], inOrder: true })
        expect(gradeJudgeReply(teapot, 'Obstacle: glue\nPicture: x\nRules: none\nNeeds: nothing\nRevises (if it happens): nothing\nAnswer: obstructed glue').form.inOrder).toBe(false)
    })

    it('reads the form against the steps it is given, so a draft can add one', () => {
        const steps = ['picture', 'rules', 'obstacle', 'needs', 'revises', 'check', 'answer']
        const withCheck = reply('obstructed glue.', ['Picture: x', 'Rules: none', 'Obstacle: nothing', 'Needs: nothing', 'Revises (if it happens): nothing', 'Check: done'])
        expect(gradeJudgeReply(teapot, withCheck, steps).form).toEqual({ missing: [], inOrder: true })
        expect(gradeJudgeReply(teapot, reply('obstructed glue.'), steps).form).toEqual({ missing: ['check'], inOrder: true })
    })

    it('flags a missing mention and an avoided word from the obstacle line and the answer sentence only', () => {
        expect(gradeJudgeReply(teapot, reply('obstructed [teapot1] is glued to [table1].')).flags).toEqual({ mentionMissing: false, avoided: [] })
        expect(gradeJudgeReply(teapot, reply('obstructed it is stuck.', ['Picture: pry it', 'Obstacle: it is stuck', 'Needs: nothing', 'Revises (if it happens): nothing'])).flags).toEqual({ mentionMissing: true, avoided: [] })
        expect(gradeJudgeReply(teapot, reply('obstructed you could unglue it, because it is glued.')).flags).toEqual({ mentionMissing: false, avoided: ['unglue'] })
    })
})

describe('summarizeJudge', () => {
    const requests: JudgeRequest[] = [teapot, { request: 'I want to pick up [cup1].', expect: 'simple' }]
    const call = (request: number, repeat: number, text: string): JudgeCall => ({ request, repeat, answer: text, grade: gradeJudgeReply(requests[request], text) })
    const calls: JudgeCall[] = [
        call(0, 1, reply('obstructed [teapot1] is glued.')),
        call(0, 2, reply('simple')),
        call(1, 1, reply('simple', ['Mentions: [cup1] established.', 'Picture: ok', 'Rules: none', 'Obstacle: nothing', 'Needs: nothing', 'Revises (if it happens): nothing', 'Tests: simple: yes'])),
        { request: 1, repeat: 2, error: 'timeout' },
    ]

    it('tallies verdicts and labels per request and in total', () => {
        const summary = summarizeJudge(requests, calls)
        expect(summary).toMatchObject({ calls: 4, pass: 2, border: 0, failure: 1, wrongSimple: 1, errors: 1, malformed: 0 })
        expect(summary.requests[0]).toMatchObject({ calls: 2, pass: 1, failure: 1, labels: { obstructed: 1, simple: 1 } })
        expect(summary.requests[1]).toMatchObject({ calls: 2, pass: 1, errors: 1 })
    })

    it('leaves out requests that were not asked', () => {
        expect(summarizeJudge(requests, [calls[0]]).requests).toHaveLength(1)
    })
})
