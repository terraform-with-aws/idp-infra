import { App } from "cdktf";
import { BaseStack } from "./base";
import PetStack from "./contrib/PetApp";
import getBaseConfig from "./contrib/PetApp/baseConfig";

const app = new App();
//@ts-ignore
const devBase = new BaseStack(app, "infra", {
  profile: "ark-dev",
});

new PetStack(app, "pet-app", {
  ...getBaseConfig(devBase),
  repository: "terraform-with-aws/apps-petapp",
  branch: "main",
  owner: "admin",
});

new PetStack(app, "pet-app-2", {
  ...getBaseConfig(devBase),
  owner: "rajshriyanshu5@gmail.com",
  repository: "terraform-with-aws/apps-petapp",
  branch: "main"
})
app.synth();
