import { App } from "cdktf";
import { BaseStack } from "./base";

const app = new App();
// @ts-ignore
const devBase = new BaseStack(app, "infra", {
  profile: "ark-dev",
});
app.synth();
