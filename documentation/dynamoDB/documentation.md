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
    - PK: `NEWS`
    - SK: `PUBLISHED_AT#${publishedAt}#ID#${id}`
    - Use: Store aggregated news articles from various sources (ESPN, Reddit, Bluesky).
    - Data: `{ id, source, headline, url, author, publishedAt, thumbnailUrl, summary, ttl }`
    - Common Queries:
        ```typescript
        // Get newest articles first
        QueryInput = {
        	TableName: "team-builder-development-main",
        	KeyConditionExpression: "PK = :pk",
        	ExpressionAttributeValues: {
        		":pk": "NEWS",
        	},
            ScanIndexForward: false, // newest first based on SK
            Limit: 100,
        };
        ```

### team-builder-{deploymentType}-users

Access Patterns:

- User Data (Clerk Integration)
    - PK: `user#${clerkUserId}`
    - SK: `metadata#`
    - Example Item:
    ```json
    {
    	"PK": "user#clerk_123abc",
    	"SK": "metadata#",
    	"clerkUserId": "clerk_123abc",
    	"createdAt": "2025-09-27T00:00:00Z",
    	"updatedAt": "2025-09-27T00:00:00Z"
    	// Additional user-specific data
    }
    ```

    - Use: Store additional user data beyond Clerk's basic auth data
    - Common Queries:
        ```typescript
        // Get user data
        QueryInput = {
        	TableName: "team-builder-development-users",
        	KeyConditionExpression: "PK = :pk AND SK = :sk",
        	ExpressionAttributeValues: {
        		":pk": "user#" + clerkUserId,
        		":sk": "metadata#",
        	},
        };
        ```
