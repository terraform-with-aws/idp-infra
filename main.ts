import { App } from "cdktf";
import { BaseStack } from "./base";
import PetStack from "./contrib/PetApp";

const app = new App();
//@ts-ignore
const devBase = new BaseStack(app, "infra", {
  profile: "ark-dev",
});

new PetStack(app, "pet-app", {
  profile: "ark-dev",
  vpcId: devBase.vpc.id,
  publicSecurityGroup: devBase.publicSecurityGroup,
  publicSubnets: devBase.publicSubnets,
  ecsClusterName: devBase.ecsCluster.name,
  appSecurityGroup: devBase.appSecurityGroup,
  appSubnet: devBase.appSubnets,
  repository: 'terraform-with-aws/apps-petapp',
  branch: 'main'
});

new pet-app(app, "pet-app", {
  ...getBaseConfig(devBase),
  profile: "ark-dev",
  repository: "terraform-with-aws/apps-petapp",
  branch: "main"
})
app.synth();
