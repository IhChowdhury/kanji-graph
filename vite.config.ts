import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Actions sets GITHUB_REPOSITORY to "owner/repo"; GitHub Pages project
// sites are served from https://<owner>.github.io/<repo>/, so the build needs
// that repo name as its base path. Local dev/build stays at "/".
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : '/',
  plugins: [react(), tailwindcss()],
})
