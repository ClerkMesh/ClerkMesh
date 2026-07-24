import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const protocol = readFileSync(new URL("./CLERK.md", import.meta.url), "utf8").trim();
const protocolHeader = "ClerkMesh Primary protocol (CLERK.md):";

/** Injects behavior only; all selection and state changes remain explicit Primary actions. */
export default function clerkMeshPrimaryExtension(pi: ExtensionAPI): void {
  pi.registerCommand("clerkmesh-status", {
    description: "Confirm that the ClerkMesh Primary behavior protocol is loaded.",
    handler: async (_args, ctx) => {
      ctx.ui.notify("ClerkMesh Primary protocol is loaded.", "info");
    },
  });

  pi.on("before_agent_start", async (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${protocolHeader}\n\n${protocol}`,
  }));
}

// Exported for focused contract tests; this contains no mutable product state.
export const clerkMeshProtocol = Object.freeze({
  source: fileURLToPath(new URL("./CLERK.md", import.meta.url)),
  header: protocolHeader,
  text: protocol,
});
