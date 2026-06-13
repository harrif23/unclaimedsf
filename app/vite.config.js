import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The ruleset + impact JSON live in ../data (shared with the workflow/grader),
// so allow Vite to read one level above the app root.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
});
