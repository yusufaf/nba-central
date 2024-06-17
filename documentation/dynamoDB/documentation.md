# Team Builder DynamoDB

## DynamoDB Tables

-   team-builder-{deploymentType}-main
    - Access Patterns:
        - Teams
            - PK: `userUUID#${userUUID}`
            - SK: `team#${teamUUID}`
        - Users
            - PK: `userUUID#${userUUID}`
            - SK: `userData`
