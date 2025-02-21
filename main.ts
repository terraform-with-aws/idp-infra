import { App } from "cdktf";
import { BaseStack } from "./base";
import PetStack from "./contrib/PetApp";
import getBaseConfig from "./contrib/baseConfig";

const app = new App();
//@ts-ignore
const devBase = new BaseStack(app, "infra", {
  profile: "ark-dev",
});

new PetStack(app, "pet-app", {
  ...getBaseConfig(devBase),
  profile: "ark-dev",
  repository: "terraform-with-aws/apps-petapp",
  branch: "main",
});

new PetStack(app, "pet-app-1", {
  ...getBaseConfig(devBase),
  profile: "ark-dev",
  repository: "terraform-with-aws/apps-petapp",
  branch: "main"
})
app.synth();
