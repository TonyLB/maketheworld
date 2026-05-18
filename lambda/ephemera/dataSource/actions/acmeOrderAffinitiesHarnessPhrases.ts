import type { AcmeOrderAffinitiesHarnessFixture } from './baseClasses'

/**
 * Phase 2.5 calibration corpus fixtures. One fixture runs as `order <commandPhrase>`.
 * Keep this module as the harness source of truth for deterministic count and slash indexing.
 */
export const ACME_ORDER_AFFINITIES_HARNESS_FIXTURES: readonly AcmeOrderAffinitiesHarnessFixture[] = [
    {
        id: 'clean-001-rocket-skates',
        bucket: 'clean',
        commandPhrase: 'rocket skates, helmet, and goggles',
        tags: ['scene-dressing', 'chase-gear', 'multi-line', 'mobility', 'contraption'],
        expectedLines: [
            {
                nameLike: 'rocket skates',
                valid: true,
                tropeAffinities: [
                    { trope: 'Contraption', aptness: 'High', narrowingLike: 'coyote mobility or pursuit rig' },
                ],
            },
            {
                nameLike: 'helmet',
                valid: true,
                tropeAffinities: [
                    { trope: 'Scene Dressing', aptness: 'Good', narrowingLike: 'protective equipment' },
                ],
            },
            {
                nameLike: 'goggles',
                valid: true,
                tropeAffinities: [
                    { trope: 'Scene Dressing', aptness: 'Good', narrowingLike: 'racing gear' },
                ],
            },
        ],
        likelyErrors: [
            'Weak Disadvantage or Finishing Move on helmet/goggles instead of Scene Dressing.',
            'Invented causal fits on helmet/goggles; missing Scene Dressing on gear.',
            'Mislabel rocket skates as Scene Dressing only or omit Contraption on the mobility anchor.',
        ],
    },
    {
        id: 'clean-002-birdseed-lure',
        bucket: 'clean',
        commandPhrase: 'a deluxe bag of birdseed',
        tags: ['lure', 'distraction', 'embedded-agent'],
        expectedLines: [{
            nameLike: 'birdseed',
            valid: true,
            tropeAffinities: [
                { trope: 'Bait', aptness: 'High', narrowingLike: 'voluntary lure or bait trail' },
                { trope: 'Disadvantage', aptness: 'High', narrowingLike: 'payload carrier for embedded trap agents' },
            ],
        }],
        likelyErrors: [
            'Over-weight Contraption because of packaging language.',
            'Confuse with Finishing Move when paired with no explicit hazard.',
        ],
    },
    {
        id: 'clean-003-glue-slick',
        bucket: 'clean',
        commandPhrase: 'glue',
        tags: ['surface-hazard', 'disadvantage', 'contraption'],
        expectedLines: [{
            nameLike: 'glue',
            valid: true,
            tropeAffinities: [
                { trope: 'Disadvantage', aptness: 'High', narrowingLike: 'immobilize feet or wheels' },
                { trope: 'Contraption', aptness: 'High', narrowingLike: 'adhesive rig component' },
            ],
        }],
        likelyErrors: [
            'Classify as Contraption because setup is pre-engagement.',
            'Inflate Finishing Move aptness despite non-terminal semantics.',
        ],
    },
    {
        id: 'clean-004-anvil-drop',
        bucket: 'clean',
        commandPhrase: 'one oversized anvil',
        tags: ['payload', 'finishing-move'],
        expectedLines: [{
            nameLike: 'anvil',
            valid: true,
            tropeAffinities: [
                { trope: 'Finishing Move', aptness: 'High', narrowingLike: 'vertical crush payload' },
                { trope: 'Contraption', aptness: 'Poor', narrowingLike: 'counterweight rig component' },
            ],
        }],
        likelyErrors: [
            'Downgrade to Disadvantage because impact is assumed non-lethal slapstick.',
            'Mark only Contraption due to delivery rig assumptions.',
        ],
    },
    {
        id: 'borderline-001-paint-kit',
        bucket: 'borderline',
        commandPhrase: 'paint',
        tags: ['art-supplies', 'cartoon-logic'],
        expectedLines: [{
            nameLike: 'paint',
            valid: true,
            tropeAffinities: [
                { trope: 'Bait', aptness: 'Good', narrowingLike: 'fake route or visual lure' },
                { trope: 'Misdirection', aptness: 'Good', narrowingLike: 'painted illusion misread as terrain' },
                { trope: 'Finishing Move', aptness: 'High', narrowingLike: 'painted tunnel collision setup' },
            ],
        }],
        likelyErrors: [
            'Return no tropeAffinities (or tropeAffinitiesFailed) despite strong in-genre uses.',
            'Collapse to a single trope without acknowledging overlap.',
        ],
    },
    {
        id: 'borderline-002-net-launcher',
        bucket: 'borderline',
        commandPhrase: 'a spring-loaded capture net launcher',
        tags: ['restraint', 'terminal'],
        expectedLines: [{
            nameLike: 'net launcher',
            valid: true,
            tropeAffinities: [
                { trope: 'Disadvantage', aptness: 'Good', narrowingLike: 'entangling restraint' },
                { trope: 'Finishing Move', aptness: 'Good', narrowingLike: 'capture as final beat' },
                { trope: 'Contraption', aptness: 'Poor', narrowingLike: 'delivery mechanism' },
            ],
        }],
        likelyErrors: [
            'Force High aptness on both Disadvantage and Finishing Move without disambiguating narrowing.',
            'Misclassify as pure Bait because lure can be attached.',
        ],
    },
    {
        id: 'borderline-003-bees-crate',
        bucket: 'borderline',
        commandPhrase: 'a reinforced crate of angry bees',
        tags: ['area-payload', 'swarm'],
        expectedLines: [{
            nameLike: 'bees',
            valid: true,
            tropeAffinities: [
                { trope: 'Finishing Move', aptness: 'Good', narrowingLike: 'swarm release payload zone' },
                { trope: 'Disadvantage', aptness: 'Good', narrowingLike: 'panic and mobility disruption' },
            ],
        }],
        likelyErrors: [
            'Drop to Poor due to realism concerns.',
            'Over-index on crate packaging as Contraption.',
        ],
    },
    {
        id: 'misclass-001-catapult-rig',
        bucket: 'likely-misclassification',
        commandPhrase: 'a reinforced catapult',
        tags: ['contraption', 'environment-affordances'],
        expectedLines: [{
            nameLike: 'catapult',
            valid: true,
            tropeAffinities: [
                { trope: 'Contraption', aptness: 'Good', narrowingLike: 'launch platform for payload delivery' },
                { trope: 'Finishing Move', aptness: 'Poor', narrowingLike: 'indirect launch setup for terminal strike' },
            ],
        }],
        likelyErrors: [
            'Omit environmentAffordances despite clear dependency on nearby payload terrain objects.',
            'Write environmentAffordances as intrinsic catapult behavior instead of scene affordances.',
        ],
    },
    {
        id: 'misclass-002-lightning-storm-kit',
        bucket: 'likely-misclassification',
        commandPhrase: 'a lightning storm starter kit',
        tags: ['phenomenon', 'hazard'],
        expectedLines: [{
            nameLike: 'lightning',
            valid: true,
            tropeAffinities: [
                { trope: 'Finishing Move', aptness: 'Good', narrowingLike: 'area hazard discharge' },
                { trope: 'Contraption', aptness: 'Poor', narrowingLike: 'coil or trigger rig support' },
            ],
        }],
        likelyErrors: [
            'Reject as Not a thing due to impossible weather control.',
            'Confuse with Bait or Misdirection and omit hazard framing.',
        ],
    },
    {
        id: 'misclass-003-giant-eraser',
        bucket: 'likely-misclassification',
        commandPhrase: 'one giant eraser',
        tags: ['cartoon-logic', 'reality-edit'],
        expectedLines: [{
            nameLike: 'eraser',
            valid: true,
            tropeAffinities: [
                { trope: 'Contraption', aptness: 'Good', narrowingLike: 'reality-edit prep or terrain alteration' },
                { trope: 'Finishing Move', aptness: 'Poor', narrowingLike: 'erase support surface payoff' },
            ],
        }],
        likelyErrors: [
            'Treat as mundane stationery and assign no useful trope fit.',
            'Return Not a thing due to cartoon-causal interpretation.',
        ],
    },
    {
        id: 'misclass-004-too-large-control',
        bucket: 'likely-misclassification',
        commandPhrase: 'North America',
        tags: ['negative-control', 'invalid'],
        expectedLines: [{
            nameLike: 'north america',
            valid: false,
            errorType: 'Too large',
        }],
        likelyErrors: [
            'Force valid packaging and fabricate tropeAffinities.',
            'Mislabel as Not tangible instead of Too large.',
        ],
    },
]

/**
 * Compatibility export for existing phrase-only callers/tests.
 */
export const ACME_ORDER_AFFINITIES_HARNESS_PHRASES: readonly string[] = ACME_ORDER_AFFINITIES_HARNESS_FIXTURES
    .map(({ commandPhrase }) => commandPhrase)
