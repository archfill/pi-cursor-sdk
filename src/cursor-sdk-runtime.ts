import * as CursorSdk from "@cursor/sdk";

export type CursorSdkModule = typeof import("@cursor/sdk");

// #228 fork deviation: pi's extension loader resolves bare specifiers only through
// the static import graph (dynamic imports and require.resolve cannot see the
// package's node_modules), so the SDK must be imported statically here.
export async function loadCursorSdk(): Promise<CursorSdkModule> {
	return CursorSdk;
}
