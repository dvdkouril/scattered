import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
	build: {
		lib: {
			// Could also be a dictionary or array of multiple entry points
			entry: resolve(__dirname, "lib/main.ts"),
			name: "scattered",
			// the proper extensions will be added
			fileName: "scattered",
			formats: ["es"],
		},
		emptyOutDir: true,
		target: "esnext",
	},
	server: {
		cors: true,
	},
	test: {
		environment: 'happy-dom',
	},
});
