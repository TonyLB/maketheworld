/**
 * Player-facing copy when intent discrimination classifies input as multiple distinct commands
 * in one line. Use with {@link isParseCommandMultipleCommandsResult} in the actions DataSource.
 */
export const MULTIPLE_COMMANDS_PLAYER_MESSAGE =
    'That looks like trying to do more than one thing in a single command. Please only try to do one thing at a time.'
