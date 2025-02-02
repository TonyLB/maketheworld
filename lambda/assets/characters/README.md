# Characters Data sub-source

The Characters data source surfaces API outlets and a subscribable stream for the asset-level
information about Characters accessible in each asset.

Characters data source is subscribed to the WML data source, and parses incoming events for
the keys of Characters that could have changed. It then consults Asset data source's materialized
internal data to give the most up to date information about the Character.

## API Outlets

- fetchAll: Fetches the table-of-contents of the aggregate library of characters available. Returns:
    - (character name, ID, summary of default example)[]

- fetchOne: Accepts a character ID and fetches all information about that character.
