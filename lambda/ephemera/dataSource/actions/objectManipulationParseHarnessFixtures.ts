import type { ObjectManipulationParseHarnessFixture } from './baseClasses'

/**
 * `/test parse` fixtures: the commands of the qualifiedReferents corpus, run through Parse and Plan
 * with no world. One fixture runs as its `command`; the 1-based order here is the slash index.
 * `corpusCase` names the corpus section the command belongs to.
 */
export const OBJECT_MANIPULATION_PARSE_HARNESS_FIXTURES: readonly ObjectManipulationParseHarnessFixture[] = [
    { id: 'c1-get-cup-on-table', corpusCase: 'C1 two cups', command: 'get the cup on the table' },
    { id: 'c1-get-cup-from-table', corpusCase: 'C1 two cups', command: 'get the cup from the table' },
    { id: 'c1-look-cup-on-table', corpusCase: 'C1 two cups', command: 'look at the cup on the table' },
    { id: 'c2-get-cloth-on-table', corpusCase: 'C2 draped cloth', command: 'get the cloth on the table' },
    { id: 'c2-get-cloth-from-table', corpusCase: 'C2 draped cloth', command: 'get the cloth from the table' },
    { id: 'c3-get-bag-from-table', corpusCase: 'C3 one bag', command: 'get bag from table' },
    { id: 'c4-put-cup-saucer-table', corpusCase: 'C4 cup, saucer, table', command: 'put cup on saucer on table' },
    { id: 'c5-take-cup-off-saucer', corpusCase: 'C5 membership tails', command: 'take cup off saucer' },
    { id: 'c5-take-coin-out-of-box', corpusCase: 'C5 membership tails', command: 'take coin out of box' },
    { id: 'c6-put-cup-on-table-in-box', corpusCase: 'C6 qualifier or destination', command: 'put the cup on the table in the box' },
    { id: 'c7-put-cup-on-table', corpusCase: 'C7 prepositions', command: 'put the cup on the table' },
    { id: 'c7-put-cup-onto-table', corpusCase: 'C7 prepositions', command: 'put the cup onto the table' },
    { id: 'c7-put-coin-into-box', corpusCase: 'C7 prepositions', command: 'put the coin into the box' },
    { id: 'c7-get-coin-in-box', corpusCase: 'C7 prepositions', command: 'get the coin in the box' },
    { id: 'c7-get-cup-off-table', corpusCase: 'C7 prepositions', command: 'get the cup off the table' },
    { id: 'c7-get-coin-out-of-box', corpusCase: 'C7 prepositions', command: 'get the coin out of the box' },
    { id: 'c7-get-cup-under-table', corpusCase: 'C7 prepositions', command: 'get the cup under the table' },
    { id: 'c7-put-cup-under-table', corpusCase: 'C7 prepositions', command: 'put the cup under the table' },
]
