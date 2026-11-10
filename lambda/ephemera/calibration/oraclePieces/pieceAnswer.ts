//
// The piece probe's grade: the last line starting `Answer:`, its first word read against the piece's closed answer set. The verdict goes
// last, as Micro needs, so any reasoning before it is free text.
//

export type PieceGrade = { answer: string } | { malformed: string }

export const pieceAnswer = (reply: string, answers: readonly string[]): PieceGrade => {
    const line = reply.split('\n').map((text) => text.trim()).filter((text) => text.startsWith('Answer:')).slice(-1)[0]
    if (line === undefined) {
        return { malformed: 'no Answer line' }
    }
    const word = (line.slice('Answer:'.length).trim().split(/\s+/)[0] ?? '').toLowerCase().replace(/\p{P}+$/u, '')
    return answers.includes(word) ? { answer: word } : { malformed: `"${word}" is not one of ${answers.join(', ')}` }
}
