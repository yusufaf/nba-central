# Team Builder DynamoDB

## DynamoDB Tables

### team-builder-{deploymentType}-main

Access Patterns:

- Teams
    - PK: `userUUID#${userUUID}`
    - SK: `team#${teamUUID}`
    - Use: Store team data associated with users

- Custom GMs
    - PK: `userUUID#${userUUID}`
    - SK: `customGM#${gmUUID}`
    - Use: Store custom General Managers created by users
    - Data: `{ gmUUID, name, teams[], createdBy, created, updated }`
    - Common Queries:
        ```typescript
        // List all custom GMs for a user
        QueryInput = {
        	TableName: "team-builder-development-main",
        	KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        	ExpressionAttributeValues: {
        		":pk": "userUUID#" + userUUID,
        		":sk": "customGM#",
        	},
        };
        ```

- Custom Coaches
    - PK: `userUUID#${userUUID}`
    - SK: `customCoach#${coachUUID}`
    - Use: Store custom Coaches created by users
    - Data: `{ coachUUID, name, overallRating, specialty, createdBy, created, updated }`
    - Common Queries:
        ```typescript
        // List all custom coaches for a user
        QueryInput = {
        	TableName: "team-builder-development-main",
        	KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        	ExpressionAttributeValues: {
        		":pk": "userUUID#" + userUUID,
        		":sk": "customCoach#",
        	},
        };
        ```

- Custom Players
    - PK: `userUUID#${userUUID}`
    - SK: `customPlayer#${playerUUID}`
    - Use: Store custom Players created by users
    - Data: `{ playerUUID, name, position, heightFeet, heightInches, weightPounds, overallRating, createdBy, created, updated }`
    - Common Queries:
        ```typescript
        // List all custom players for a user
        QueryInput = {
        	TableName: "team-builder-development-main",
        	KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        	ExpressionAttributeValues: {
        		":pk": "userUUID#" + userUUID,
        		":sk": "customPlayer#",
        	},
        };
        ```

- News Aggregator
    - PK: `NEWS#${source}` (one of `NEWS#ESPN`, `NEWS#CBS`, `NEWS#RealGM`, `NEWS#Bluesky`)
    - SK: `PUBLISHED_AT#${publishedAt}#ID#${id}`
    - Use: Store aggregated news articles from various sources (ESPN, CBS Sports,
      RealGM, Bluesky).
      Partitioned per source so a high-volume source cannot consume the entire read
      window and leave the other source filters empty in the UI.
    - Data: `{ id, source, headline, url, author, publishedAt, thumbnailUrl, summary, ttl }`
    - Common Queries:
        ```typescript
        // Get newest articles first, for a single source. getNews issues one of
        // these per source in parallel, then merges and sorts by publishedAt.
        QueryInput = {
        	TableName: "team-builder-development-main",
        	KeyConditionExpression: "PK = :pk",
        	ExpressionAttributeValues: {
        		":pk": "NEWS#ESPN",
        	},
            ScanIndexForward: false, // newest first based on SK
            Limit: 40,
        };
        ```

### team-builder-{deploymentType}-users

Access Patterns:

- User metadata (settings)
    - PK: `userUUID#${userUUID}` — `userUUID` is the Logto `sub` from the
      authorizer context (`event.requestContext.authorizer.lambda.sub`), never
      a value from the request
    - SK: `metadata#`
    - Use: One item per user. `settings` is a single map of flat
      `<section>.<field>` keys, validated against the allowlist in
      `models/user-settings.ts` on every write. Read by `getUserSettings`,
      written by `updateUserSettings`.
    - Example Item:
    ```json
    {
    	"PK": "userUUID#abc123",
    	"SK": "metadata#",
    	"settings": {
    		"playerStats.statMode": "totals",
    		"scores.hideScores": true
    	},
    	"settingsUpdatedAt": "2026-09-28T00:00:00.000Z",
    	"createdAt": "2026-09-28T00:00:00.000Z"
    }
    ```

    - `settingsUpdatedAt` is absent until the user's first write; the web
      client reads that as "never synced" and migrates its localStorage
      preferences up once, with `initialize: true`: that write only creates
      the map (`attribute_not_exists(settings)`), and if another device got
      there first it writes nothing and returns the stored settings.
    - Writes set only the patched keys (`SET #settings.#key = :value`,
      conditioned on the map existing), so concurrent saves of different
      fields from two devices don't overwrite each other. The first write
      creates the map instead (`attribute_not_exists(settings)`).
    - Common Queries:
        ```typescript
        // Get a user's settings
        GetItemInput = {
        	TableName: "team-builder-development-users",
        	Key: { PK: "userUUID#" + userUUID, SK: "metadata#" },
        };
        ```
