import { SecurityGroup, Subnet } from "@cdktf/provider-aws/lib/vpc";
import { BaseStack } from "../../base";

export interface BaseConfig {
  vpcId: string;
  publicSecurityGroup: SecurityGroup;
  appSecurityGroup: SecurityGroup;
  publicSubnets: Subnet[];
  appSubnet: Subnet[];
  ecsClusterName: string;
  profile: string;
  repository: string;
}

export default function getBaseConfig (devBase: BaseStack): BaseConfig {
  return {
    profile: "ark-dev",
  repository: "terraform-with-aws/apps-petapp",
    vpcId: devBase.vpc.id,
    publicSecurityGroup: devBase.publicSecurityGroup,
    publicSubnets: devBase.publicSubnets,
    ecsClusterName: devBase.ecsCluster.name,
    appSecurityGroup: devBase.appSecurityGroup,
    appSubnet: devBase.appSubnets,
  };
}
