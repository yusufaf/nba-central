import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
	Certificate,
	CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";

// Cross-region ACM certificate stack. CloudFront and Cognito hosted-UI custom
// domains both require their certificate to live in us-east-1, regardless of
// which region the rest of the app deploys to (team-builder-cdk deploys to
// us-west-2). This has to be a dedicated Stack (not a Construct) pinned to
// env.region: "us-east-1" — cross-region references only work stack-to-stack,
// with crossRegionReferences: true set on both the producer (this stack) and
// the consumer (TeamBuilderStack). There's no DnsValidatedCertificate
// construct in aws-cdk-lib@2.254.0 (removed) — this uses the plain
// Certificate construct with CertificateValidation.fromDns() instead.
//
// HostedZone.fromHostedZoneAttributes() is used deliberately instead of
// HostedZone.fromLookup() — fromLookup() performs a live AWS context lookup
// at synth time, which breaks the dummy-account (`000000000000`) CI synth
// path that has no real AWS credentials.
export interface TeamBuilderCertStackProps extends StackProps {
	appName?: string;
	deploymentType?: string;
	hostedZoneId: string;
	hostedZoneName: string;
}

export class TeamBuilderCertStack extends Stack {
	readonly webCertificateArn: string;
	readonly authCertificateArn: string;

	constructor(scope: Construct, id: string, props: TeamBuilderCertStackProps) {
		super(scope, id, props);

		const {
			appName = "team-builder",
			deploymentType = "production",
			hostedZoneId,
			hostedZoneName,
		} = props;

		const hostedZoneNameAndId = `${appName}-${deploymentType}-hosted-zone`;
		const hostedZone = HostedZone.fromHostedZoneAttributes(
			this,
			hostedZoneNameAndId,
			{
				hostedZoneId,
				zoneName: hostedZoneName,
			},
		);

		const webCertificateNameAndId = `${appName}-${deploymentType}-web-cert`;
		const webCertificate = new Certificate(this, webCertificateNameAndId, {
			domainName: "nba.yusufaf.dev",
			validation: CertificateValidation.fromDns(hostedZone),
		});

		const authCertificateNameAndId = `${appName}-${deploymentType}-auth-cert`;
		const authCertificate = new Certificate(this, authCertificateNameAndId, {
			domainName: "auth.yusufaf.dev",
			validation: CertificateValidation.fromDns(hostedZone),
		});

		this.webCertificateArn = webCertificate.certificateArn;
		this.authCertificateArn = authCertificate.certificateArn;
	}
}
