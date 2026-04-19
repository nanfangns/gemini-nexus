import { cpSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_COPY_TARGETS = [
    'manifest.json',
    'background',
    'content',
    'services',
    'lib',
    'libs',
    'logo.png'
];

function copyExtensionPackage(): Plugin {
    return {
        name: 'copy-extension-package',
        apply: 'build',
        closeBundle() {
            const distDir = path.resolve(__dirname, 'dist');

            for (const target of EXTENSION_COPY_TARGETS) {
                const source = path.resolve(__dirname, target);
                const destination = path.resolve(distDir, target);

                mkdirSync(path.dirname(destination), { recursive: true });
                cpSync(source, destination, { recursive: true, force: true });
            }
        }
    };
}

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [copyExtensionPackage()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          input: {
            sidepanel: path.resolve(__dirname, 'sidepanel/index.html'),
            sandbox: path.resolve(__dirname, 'sandbox/index.html')
          }
        }
      }
    };
});
