export const unique = (...lists) => ([
    ...(new Set(lists.reduce((previous, item) => ([ ...previous, ...item ]), [])))
])
