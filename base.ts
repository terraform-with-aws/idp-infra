import { AwsProvider, dynamodb, ec2, ecs, ssm } from "@cdktf/provider-aws";
import {
  SecurityGroup,
  SecurityGroupRule,
  Subnet,
  Vpc,
} from "@cdktf/provider-aws/lib/vpc";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";

interface BaseStackConfig {
  profile: string;
}

export class BaseStack extends TerraformStack {
  public readonly vpc: Vpc;
  public readonly publicSubnet: Subnet;
  public readonly appSubnet: Subnet;
  public readonly dbSubnet: Subnet;
  public readonly publicSecurityGroup: SecurityGroup;
  public readonly appSecurityGroup: SecurityGroup;
  public readonly dbSecurityGroup: SecurityGroup;
  public readonly dynamodbTable: dynamodb.DynamodbTable;

  constructor(scope: Construct, name: string, config: BaseStackConfig) {
    super(scope, name);

    new AwsProvider(this, "ark-dev", {
      region: "ap-south-1",
      profile: config.profile,
    });

    // Create VPC
    const vpc = new Vpc(this, "vpc", {
      cidrBlock: "10.0.0.0/16",
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: {
        name: "my_vpc",
      },
    });
    this.vpc = vpc;

    // Create Public Subnet
    const publicSubnet = new Subnet(this, "PublicSubnet", {
      vpcId: vpc.id,
      cidrBlock: "10.0.1.0/24",
      availabilityZone: "ap-south-1a",
      mapPublicIpOnLaunch: true,
      tags: {
        name: "public_subnet",
      },
    });
    this.publicSubnet = publicSubnet;

    // Create Private Subnet
    const appSubnet = new Subnet(this, "AppSubnet", {
      vpcId: vpc.id,
      cidrBlock: "10.0.4.0/24",
      availabilityZone: "ap-south-1b",
      tags: {
        name: "app_ubnet",
      },
    });
    this.appSubnet = appSubnet;

    // Create dbSubnet
    const dbSubnet = new Subnet(this, "DbSubnet", {
      vpcId: vpc.id,
      cidrBlock: "10.0.8.0/24",
      availabilityZone: "ap-south-1c",
      tags: {
        name: "db_subnet",
      },
    });
    this.dbSubnet = dbSubnet;



    // Create Public Security Group
    const publicSecurityGroup = new SecurityGroup(this, "PublicSecurityGroup", {
      vpcId: vpc.id,
      name: "public_sg",
    });
    new SecurityGroupRule(this, "PublicSecurityGroupRule", {
      securityGroupId: publicSecurityGroup.id,
      type: "ingress",
      fromPort: 80,
      toPort: 80,
      protocol: "tcp",
      cidrBlocks: ["0.0.0.0/0"],
    });
    new SecurityGroupRule(this, "PublicSecurityGroupRule2", {
      securityGroupId: publicSecurityGroup.id,
      type: "ingress",
      fromPort: 443,
      toPort: 443,
      protocol: "tcp",
      cidrBlocks: ["0.0.0.0/0"],
    });
    this.publicSecurityGroup = publicSecurityGroup;



    // App Security Group
    const appSecurityGroup = new SecurityGroup(this, "AppSecurityGroup", {
      vpcId: vpc.id,
      name: "app_sg",
    });
    new SecurityGroupRule(this, "AppSecurityGroupRule", {
      securityGroupId: appSecurityGroup.id,
      type: "ingress",
      fromPort: 0,
      toPort: 65535,
      protocol: "tcp",
      cidrBlocks: [publicSubnet.cidrBlock],
    });
    this.appSecurityGroup = appSecurityGroup;


    const dbSecurityGroup = new SecurityGroup(this, "DbSecurityGroup", {
      vpcId: vpc.id,
      name: "db-sg",
      description: "Allow ingress from app security group",
    });
    new SecurityGroupRule(this, "DbIngressFromApp", {
      securityGroupId: dbSecurityGroup.id,
      type: "ingress",
      fromPort: 0,
      toPort: 65535,
      protocol: "tcp",
      cidrBlocks: [dbSubnet.cidrBlock],
    });
    this.dbSecurityGroup = dbSecurityGroup;


    // Define the ECS Service-Linked Role
    // new iam.IamServiceLinkedRole(this, "ecs", {
    //   awsServiceName: "ecs.amazonaws.com",
    // });
    

    const ecsCluster = new ecs.EcsCluster(this, "ecs-cluster", {
      name: "main",
    })

    new ecs.EcsClusterCapacityProviders(this, "ecs-capacity-provider", {
      clusterName: ecsCluster.name,
      capacityProviders: ["FARGATE"]
    })

    const dynamoDBTable = new dynamodb.DynamodbTable(this, 'idp-environment', {
      name: 'idp-environment',
      billingMode: 'PROVISIONED',
      readCapacity: 2,
      writeCapacity: 2,
      hashKey: "environment",
      attribute: [{
        name: "environment",
        type: "S", 
      }],
    })
    this.dynamodbTable = dynamoDBTable;



    const amiId = new ssm.DataAwsSsmParameter(this, 'latest-amazon-linux-2-ami-id', {
      name: '/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2'
    })

    new ec2.Instance(this, 'activation', {
      ami: amiId.value,
      instanceType: 't2.micro', // If `t2.micro` is not available in your region, choose `t3.micro` to keep using the Free Tier,
      associatePublicIpAddress: false,
      subnetId: appSubnet.id,
    })
  }
}
