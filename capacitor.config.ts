import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.mesh",
  appName: "Mesh",
  webDir: ".output/public",
  server: {
    androidScheme: "https",
  },
};

export default config;
