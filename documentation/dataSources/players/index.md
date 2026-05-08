# Player Data Source

## Stream

**Source**: mtw.players

Initialization entrypoint:

- New account initialization is triggered by `mtw.cognito` / `New Player` and healed idempotently by `AssetsFunction`.
- `mtw.cognito` / `New Player` is published from both Cognito PostConfirmation (`PostConfirmation_ConfirmSignUp`) and the admin signup path (`connections` `/signUp` via `AdminCreateUser`), so admin-created users do not require manual Heal.

Events:

- New Player
- Player Connected
- Player Disconnected
- Authorization Update [To Be Implemented]
- Assets Update [To Be Implemented]

