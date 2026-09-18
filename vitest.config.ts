import { defineConfig } from 'vitest/config'

// Deliberately separate from vite.config.ts (rather than merging it): the
// current test suite is pure TS/logic (no component rendering), so it
// doesn't need the react()/tailwindcss() plugins, and importing them here
// pulls in a second, incompatible copy of vite's plugin types via
// vitest's own nested vite dependency.
export default defineConfig({
  test: {
    environment: 'node',
  },
})
