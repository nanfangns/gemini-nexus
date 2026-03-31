
// background/control/actions/observation/visual.js
import { BaseActionHandler } from '../base.js';

export class VisualActions extends BaseActionHandler {
    
    async takeScreenshot({ filePath } = {}) {
        try {
            const dataUrl = await new Promise(resolve => {
                chrome.tabs.captureVisibleTab(null, { format: 'png' }, (data) => {
                    if (chrome.runtime.lastError) {
                        console.error("Screenshot failed:", chrome.runtime.lastError);
                        resolve(null);
                    } else {
                        resolve(data);
                    }
                });
            });

            if (!dataUrl) return "Error: Failed to capture screenshot.";

            let message = `Screenshot taken (Base64 length: ${dataUrl.length}).`;

            // If a filePath (filename) is provided, download it
            if (filePath) {
                try {
                    // Extract safe filename from path
                    const filename = filePath.split(/[/\\]/).pop() || 'screenshot.png';

                    const downloadId = await new Promise((resolve, reject) => {
                        chrome.downloads.download({
                            url: dataUrl,
                            filename: filename,
                            saveAs: false // Don't prompt save as dialog
                        }, (id) => {
                            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                            else resolve(id);
                        });
                    });
                    message += ` Saved to ${filename} (Download ID: ${downloadId}).`;
                } catch (err) {
                    message += ` Failed to save: ${err.message}`;
                }
            } else {
                message += " [Internal: Image attached to chat history]";
            }

            return {
                text: message,
                image: dataUrl
            };
        } catch (e) {
            return `Error taking screenshot: ${e.message}`;
        }
    }
}
