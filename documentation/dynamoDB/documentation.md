# Team Builder DynamoDB

## DynamoDB Tables

### team-builder-{deploymentType}-main

Access Patterns:

- Teams
    - PK: `userUUID#${userUUID}`
    - SK: `team#${teamUUID}`
    - Use: Store team data associated with users

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
