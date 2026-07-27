import { Table, AttributeType, BillingMode } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { ExtendedStackProps } from "models/stack";

export class TeamBuilderDynamoDB extends Construct {
	constructor(scope: Construct, id: string, props: ExtendedStackProps) {
		super(scope, id);
		const {
			appName = "team-builder",
			deploymentType = "development",
			env,
		} = props;
		const { account = "", region = "" } = env!;

		const mainTableName = `${appName}-${deploymentType}-main`;
		this.createDynamoDBTable({
			tableName: mainTableName,
		});

		const usersTableName = `${appName}-${deploymentType}-users`;
		this.createDynamoDBTable({
			tableName: usersTableName,
		});
	}

	createDynamoDBTable = ({
		tableName,
		addGSIs = true,
		numGSIs = 2, // Default to creating PK2/SK2 & PK3/SK3
	}: {
		tableName: string;
		addGSIs?: boolean;
		numGSIs?: number;
	}): Table => {
		const dynamoDBTable = new Table(this, tableName, {
			tableName,
			partitionKey: { name: "PK", type: AttributeType.STRING },
			sortKey: { name: "SK", type: AttributeType.STRING },
			billingMode: BillingMode.PAY_PER_REQUEST,
			pointInTimeRecoverySpecification: {
				pointInTimeRecoveryEnabled: true,
			},
			timeToLiveAttribute: "ttl",
		});

		if (addGSIs) {
			for (let i = 0; i < numGSIs; ++i) {
				const index = i + 2; // starting with PK2
				dynamoDBTable.addGlobalSecondaryIndex({
					indexName: `PK${index}`,
					partitionKey: {
						name: `PK${index}`,
						type: AttributeType.STRING,
					},
					sortKey: { name: `SK${index}`, type: AttributeType.STRING },
				});
			}
		}

		return dynamoDBTable;
	};
}
