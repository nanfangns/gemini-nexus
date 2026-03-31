// sandbox/boot/loader.js
import { configureMarkdown } from '../render/config.js';

export function loadScript(src, fallbackSrc = null) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => {
            if (fallbackSrc) {
                console.warn(`Failed to load ${src}, falling back to ${fallbackSrc}`);
                const fallbackScript = document.createElement('script');
                fallbackScript.src = fallbackSrc;
                fallbackScript.onload = resolve;
                fallbackScript.onerror = reject;
                document.head.appendChild(fallbackScript);
            } else {
                reject(new Error(`Failed to load script: ${src}`));
            }
        };
        document.head.appendChild(script);
    });
}

export function loadCSS(href, fallbackHref = null) {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = resolve;
        link.onerror = () => {
            if (fallbackHref) {
                console.warn(`Failed to load CSS ${href}, falling back to ${fallbackHref}`);
                const fallbackLink = document.createElement('link');
                fallbackLink.rel = 'stylesheet';
                fallbackLink.href = fallbackHref;
                fallbackLink.onload = resolve;
                fallbackLink.onerror = reject;
                document.head.appendChild(fallbackLink);
            } else {
                reject(new Error(`Failed to load CSS: ${href}`));
            }
        };
        document.head.appendChild(link);
    });
}

export async function loadLibs() {
    try {
        // Load Marked (Priority for chat rendering)
        // Increased timeout to 10 seconds for more lenient loading
        const loadMarked = loadScript(
            'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
            '/libs/marked.min.js'
        );
        const timeout = new Promise((_, reject) => setTimeout(() => reject('CDN Timeout'), 10000));

        await Promise.race([loadMarked, timeout]).catch(e => {
            console.warn("Marked load issue:", e);
            // Try to continue anyway, as configureMarkdown will check for marked existence
        });

        // Re-run config now that marked is loaded
        configureMarkdown();

        // Load others in parallel with fallbacks
        loadCSS(
            'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
            '/libs/katex.min.css'
        ).catch(e => console.warn("KaTeX CSS load failed", e));

        loadCSS(
            'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css',
            '/libs/atom-one-dark.min.css'
        ).catch(e => console.warn("Highlight.js CSS load failed", e));

        Promise.all([
            loadScript(
                'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js',
                '/libs/highlight.min.js'
            ),
            loadScript(
                'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
                '/libs/katex.min.js'
            ),
            loadScript(
                'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.basic.min.js',
                '/libs/fuse.min.js'
            )
        ])
        .then(() => {
            // Auto-render ext for KaTeX
            return loadScript(
                'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js',
                '/libs/auto-render.min.js'
            ).catch(e => console.warn("Auto-render KaTeX extension load failed", e));
        })
        .catch(e => console.warn("Some optional libs failed to load", e));

        console.log("Dependencies loading with fallbacks...");
    } catch (e) {
        console.warn("Loading dependencies failed", e);
    }
}