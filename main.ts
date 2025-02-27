import { App } from "cdktf";
import { BaseStack } from "./base";
import PetStack from "./contrib/PetStack";
import getBaseConfig from "./contrib/PetStack/getBaseConfig";

const app = new App();
//@ts-ignore
const devBase = new BaseStack(app, "infra", {
  profile: "ark-dev",
});

new PetStack(app, "pet-app", {
  ...getBaseConfig(devBase),
  branch: "main",
  owner: "admin",
});


app.synth();
