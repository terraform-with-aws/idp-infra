import {
  AwsProvider,
  codebuild,
  dynamodb,
  ec2,
  ecs,
  iam,
} from "@cdktf/provider-aws";
import { Eip } from "@cdktf/provider-aws/lib/ec2";
import {
  InternetGateway,
  NatGateway,
  Route,
  RouteTable,
  RouteTableAssociation,
  SecurityGroup,
  SecurityGroupRule,
  Subnet,
  Vpc,
} from "@cdktf/provider-aws/lib/vpc";
import { Fn, TerraformStack } from "cdktf";
import { Construct } from "constructs";

interface BaseStackConfig {
  profile: string;
}

export class BaseStack extends TerraformStack {
  public readonly vpc: Vpc;
  public readonly publicSubnets: Subnet[];
  public readonly appSubnets: Subnet[];
  public readonly dbSubnets: Subnet[];
  public readonly ecsCluster: ecs.EcsCluster;
  public readonly publicSecurityGroup: SecurityGroup;
  public readonly appSecurityGroup: SecurityGroup;
  public readonly dataSecurityGroup: SecurityGroup;
  public readonly dynamodbTable: dynamodb.DynamodbTable;

  constructor(scope: Construct, name: string, config: BaseStackConfig) {
    super(scope, name);

    new AwsProvider(this, "ark-dev", {
      region: "ap-south-1",
      profile: config.profile,
    });

    // Create VPC
    const availabilityZones = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]; // Adjust for your region

    // Create VPC
    const vpc = new Vpc(this, "DevVPC", {
      cidrBlock: "10.1.0.0/16",
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: { Name: "DevVPC" },
    });

    // Create Internet Gateway
    const igw = new InternetGateway(this, "InternetGateway", {
      vpcId: vpc.id,
      tags: { Name: "DevVPC-IGW" },
    });

    // Create Public Subnets
    const publicSubnets = availabilityZones.map(
      (az, index) =>
        new Subnet(this, `PublicSubnet${index}`, {
          vpcId: vpc.id,
          cidrBlock: `10.1.${index + 1}.0/24`,
          availabilityZone: az,
          mapPublicIpOnLaunch: true,
          tags: { Name: `PublicSubnet-${az}` },
        })
    );

    // Create NAT Gateway
    const natEip = new Eip(this, "NatEip");
    const natGateway = new NatGateway(this, "NatGateway", {
      subnetId: publicSubnets[0].id, // Placing NAT Gateway in the first public subnet
      allocationId: natEip.id,
      tags: { Name: "DevVPC-NATGW" },
    });

    // Create Application Subnets
    const appSubnets = availabilityZones.map(
      (az, index) =>
        new Subnet(this, `AppSubnet${index + 1}`, {
          vpcId: vpc.id,
          cidrBlock: `10.1.${index + 4}.0/24`,
          availabilityZone: az,
          tags: { Name: `AppSubnet-${az}` },
        })
    );

    // Create Database Subnets
    const dbSubnets = availabilityZones.map(
      (az, index) =>
        new Subnet(this, `DbSubnet${index + 1}`, {
          vpcId: vpc.id,
          cidrBlock: `10.1.${index + 8}.0/24`,
          availabilityZone: az,
          tags: { Name: `DbSubnet-${az}` },
        })
    );

    // Create Public Route Table and Associate with Public Subnets
    const publicRouteTable = new RouteTable(this, "PublicRouteTable", {
      vpcId: vpc.id,
      tags: { Name: "PublicRouteTable" },
    });

    new Route(this, "PublicRoute", {
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: igw.id,
    });

    publicSubnets.forEach((subnet, index) => {
      new RouteTableAssociation(this, `PublicRouteAssoc${index + 1}`, {
        subnetId: subnet.id,
        routeTableId: publicRouteTable.id,
      });
    });

    // Create Private Route Table for Application and Database Subnets
    const privateRouteTable = new RouteTable(this, "PrivateRouteTable", {
      vpcId: vpc.id,
      tags: { Name: "PrivateRouteTable" },
    });

    new Route(this, "PrivateRoute", {
      routeTableId: privateRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway.id,
    });

    appSubnets.concat(dbSubnets).forEach((subnet, index) => {
      new RouteTableAssociation(this, `PrivateRouteAssoc${index + 1}`, {
        subnetId: subnet.id,
        routeTableId: privateRouteTable.id,
      });
    });

    const publicSG = new SecurityGroup(this, "PublicSecurityGroup", {
      vpcId: vpc.id,
      name: "PublicSG",
    });

    const appSG = new SecurityGroup(this, "AppSecurityGroup", {
      vpcId: vpc.id,
      name: "AppSG",
    });

    const dataSG = new SecurityGroup(this, "DataSecurityGroup", {
      vpcId: vpc.id,
      name: "DataSG",
    });

    // Allow all egress traffic for all security groups
    new SecurityGroupRule(this, "Egress-public", {
      securityGroupId: publicSG.id,
      type: "egress",
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      cidrBlocks: ["0.0.0.0/0"],
    });
    new SecurityGroupRule(this, "Egress-app", {
      securityGroupId: appSG.id,
      type: "egress",
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      cidrBlocks: ["0.0.0.0/0"],
    });
    new SecurityGroupRule(this, "Egress-data", {
      securityGroupId: dataSG.id,
      type: "egress",
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      cidrBlocks: ["0.0.0.0/0"],
    });

    // Allow ingress within the same security group
    new SecurityGroupRule(this, `SelfIngressEgress-public`, {
      securityGroupId: publicSG.id,
      type: "ingress",
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      selfAttribute: true,
    });
    new SecurityGroupRule(this, `SelfIngressEgress-app`, {
      securityGroupId: appSG.id,
      type: "ingress",
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      selfAttribute: true,
    });
    new SecurityGroupRule(this, "SelfIngressEgress-data", {
      securityGroupId: dataSG.id,
      type: "ingress",
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      selfAttribute: true,
    });

    // Public SG allows HTTP & HTTPS from any IP
    [80, 443].forEach((port, index) => {
      new SecurityGroupRule(this, `PublicSG-Ingress-${index}`, {
        securityGroupId: publicSG.id,
        type: "ingress",
        fromPort: port,
        toPort: port,
        protocol: "tcp",
        cidrBlocks: ["0.0.0.0/0"],
      });
    });

    // App SG allows traffic from Public SG
    new SecurityGroupRule(this, "AppSG-From-PublicSG", {
      securityGroupId: appSG.id,
      type: "ingress",
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      cidrBlocks: publicSubnets.map((subnet) => subnet.cidrBlock),
    });

    // Data SG allows traffic from App SG
    new SecurityGroupRule(this, "DataSG-From-AppSG", {
      securityGroupId: dataSG.id,
      type: "ingress",
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      cidrBlocks: appSubnets.map((subnet) => subnet.cidrBlock),
    });

    // // Define the ECS Service-Linked Role
    // // new iam.IamServiceLinkedRole(this, "ecs", {
    // //   awsServiceName: "ecs.amazonaws.com",
    // // });

    const ecsCluster = new ecs.EcsCluster(this, "ecs-cluster", {
      name: "main",
    });

    new ecs.EcsClusterCapacityProviders(this, "ecs-capacity-provider", {
      clusterName: ecsCluster.name,
      capacityProviders: ["FARGATE"],
    });

    const dynamoDBTable = new dynamodb.DynamodbTable(this, "idp-environment", {
      name: "idp-environment",
      billingMode: "PROVISIONED",
      readCapacity: 2,
      writeCapacity: 2,
      hashKey: "environment",
      attribute: [
        {
          name: "environment",
          type: "S",
        },
      ],
    });

    // @ts-ignore
    const environmentTypesTable = new dynamodb.DynamodbTable(
      this,
      `${name}-idp-environment-type`,
      {
        name: `${name}-idp-environment-type`,
        billingMode: "PROVISIONED",
        readCapacity: 2,
        writeCapacity: 2,
        hashKey: "envType",
        attribute: [
          {
            name: "envType",
            type: "S", // S = string, N = number, B = binary
          },
        ],
      }
    );

    const codebuildServiceRoleAssumeRolePolicyDocument =
      new iam.DataAwsIamPolicyDocument(
        this,
        "codebuildServiceRoleAssumeRolePolicyDocument",
        {
          statement: [
            {
              effect: "Allow",
              principals: [
                {
                  type: "Service",
                  identifiers: ["codebuild.amazonaws.com"],
                },
              ],
              actions: ["sts:AssumeRole"],
            },
          ],
        }
      );

    const codebuildServiceRole = new iam.IamRole(this, "codebuildServiceRole", {
      name: `codebuild-service-role-infra-environment-types-dynamodb-sync`,
      assumeRolePolicy: codebuildServiceRoleAssumeRolePolicyDocument.json,
    });

    const codebuildServiceRolePolicy = new iam.IamPolicy(
      this,
      "codebuildServiceRolePolicy",
      {
        policy: Fn.jsonencode({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "cloudwatch:*",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "s3:PutObject",
                "s3:GetObject",
                "s3:GetObjectVersion",
                "s3:GetBucketAcl",
                "s3:GetBucketLocation",

                // Allow CodeBuild access to AWS services required to create a VPC network interface
                "ec2:CreateNetworkInterface",
                "ec2:DescribeDhcpOptions",
                "ec2:DescribeNetworkInterfaces",
                "ec2:DeleteNetworkInterface",
                "ec2:DescribeSubnets",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeVpcs",
                "ec2:CreateNetworkInterfacePermission",
              ],
              Resource: ["*"],
            },
          ],
        }),
      }
    );

    new iam.IamRolePolicyAttachment(
      this,
      "codebuildServiceRoleRolePolicyAttachment",
      {
        role: codebuildServiceRole.name,
        policyArn: codebuildServiceRolePolicy.arn,
      }
    );

    new iam.IamRolePolicyAttachment(
      this,
      "codebuildServiceRoleRolePolicyAttachmentAWSCodeBuildAdminAccess",
      {
        role: codebuildServiceRole.name,
        policyArn: "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess",
      }
    );

    const project = new codebuild.CodebuildProject(this, "project", {
      dependsOn: [environmentTypesTable],
      name: `infra-environment-types-dynamodb-sync`,
      serviceRole: codebuildServiceRole.arn,
      artifacts: { type: "NO_ARTIFACTS" },
      environment: {
        computeType: "BUILD_GENERAL1_SMALL", // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-compute-types.html
        type: "LINUX_CONTAINER", // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-compute-types.html
        image: "aws/codebuild/standard:5.0", // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
        imagePullCredentialsType: "CODEBUILD", // https://docs.aws.amazon.com/codebuild/latest/userguide/create-project-cli.html#cli.environment.imagepullcredentialstype
        privilegedMode: false,
      },
      source: {
        type: "GITHUB",
        location: `https://github.com/terraform-with-aws/idp-infra`,
        gitCloneDepth: 1, // Only get the latest revision
        gitSubmodulesConfig: {
          fetchSubmodules: true,
        },
        reportBuildStatus: true,
        // Available Environment Variables - https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html
        buildspec: `
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 14
  pre_build:
    commands:
      - echo Installing dependencies
      - npm install
  build:
    commands:
      - echo Running synchronization script    
      - DYNAMODB_TABLE_NAME=${environmentTypesTable.name} npx ts-node ./scripts/syncEnvType.ts
`,
      },
      vpcConfig: {
        vpcId: vpc.id,
        securityGroupIds: [appSG.id],
        subnets: appSubnets.map((subnet) => subnet.id) || [],
      },
    });

    new codebuild.CodebuildWebhook(this, "webhook", {
      projectName: project.name,
      buildType: "BUILD",
      // https://docs.aws.amazon.com/codebuild/latest/userguide/github-webhook.html
      filterGroup: [
        {
          filter: [
            {
              type: "EVENT",
              pattern: "PUSH",
            },
            {
              type: "HEAD_REF",
              pattern: "main",
            },
          ],
        },
      ],
    });

    // const amiId = new ssm.DataAwsSsmParameter(this, 'latest-amazon-linux-2-ami-id', {
    //   name: '/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2'
    // })

    //bugfix
    new ec2.Instance(this, "activation", {
      ami: "ami-0ddfba243cbee3768",
      instanceType: "t2.micro",
      associatePublicIpAddress: false,
      subnetId: appSubnets[0].id,
    });

    this.vpc = vpc;
    this.publicSecurityGroup = publicSG;
    this.appSecurityGroup = appSG;
    this.dataSecurityGroup = dataSG;
    this.ecsCluster = ecsCluster;
    this.dynamodbTable = dynamoDBTable;
    this.publicSubnets = publicSubnets;
    this.appSubnets = appSubnets;
    this.dbSubnets = dbSubnets;
  }
}
