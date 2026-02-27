import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
	const isSite = mode === "site";

	const config = {
		base: isSite ? "/scattered/" : "/",
		build: {
			emptyOutDir: true,
			target: "esnext",
		},
		server: {
			cors: true,
		},
		test: {
			environment: "happy-dom",
		},
	};

	if (!isSite) {
		config.build.lib = {
			entry: resolve(__dirname, "lib/main.ts"),
			name: "scattered",
			fileName: "scattered",
			formats: ["es"],
		};
	}

	return config;
});
