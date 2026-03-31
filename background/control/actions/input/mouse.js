
// background/control/actions/input/mouse.js
import { BaseActionHandler } from '../base.js';

export class MouseActions extends BaseActionHandler {
    
    async clickElement({ uid, dblClick = false }) {
        const objectId = await this.getObjectIdFromUid(uid);
        const backendNodeId = this.snapshotManager.getBackendNodeId(uid);

        try {
            let x, y;
            
            // Retry loop for layout stability
            // Frames/Layouts might be re-calculating (e.g. hydration)
            const MAX_RETRIES = 3;
            for (let i = 0; i < MAX_RETRIES; i++) {
                try {
                    // 1. Scroll element into view
                    await this.cmd("DOM.scrollIntoViewIfNeeded", { objectId });
                    
                    // 2. Get box model
                    const { model } = await this.cmd("DOM.getBoxModel", { backendNodeId });
                    if (!model || !model.content) throw new Error("No box model");
                    
                    x = (model.content[0] + model.content[4]) / 2;
                    y = (model.content[1] + model.content[5]) / 2;
                    
                    // If we got here, layout is present
                    break;
                } catch (e) {
                    const isLayoutError = e.message.includes("layout object") || e.message.includes("Node is detached");
                    if (isLayoutError && i < MAX_RETRIES - 1) {
                        // Wait and retry
                        await new Promise(r => setTimeout(r, 150));
                        continue;
                    }
                    throw e;
                }
            }

            // 3. Occlusion Check (Hit Test)
            const hitTestResult = await this.cmd("Runtime.callFunctionOn", {
                objectId: objectId,
                functionDeclaration: `function(x, y) {
                    const el = document.elementFromPoint(x, y);
                    if (!el) return false;
                    return this.contains(el) || el.contains(this);
                }`,
                arguments: [{ value: x }, { value: y }],
                returnByValue: true
            });

            // Resilient Occlusion Detection:
            // Instead of throwing an error that stops the action, throw a specific error
            // to trigger immediate JS fallback logic in the catch block.
            if (!hitTestResult.result || hitTestResult.result.value === false) {
                // console.warn(`[MouseActions] Click at ${Math.round(x)},${Math.round(y)} is occluded.`);
                throw new Error("OCCLUSION_DETECTED");
            }

            // 4. Dispatch Trusted Input Events
            await this.waitHelper.execute(async () => {
                await this.cmd("Input.dispatchMouseEvent", { 
                    type: "mouseMoved", x, y 
                });
                await this.cmd("Input.dispatchMouseEvent", { 
                    type: "mousePressed", x, y, button: "left", clickCount: 1 
                });
                await this.cmd("Input.dispatchMouseEvent", { 
                    type: "mouseReleased", x, y, button: "left", clickCount: 1 
                });

                if (dblClick) {
                    await this.cmd("Input.dispatchMouseEvent", { 
                        type: "mousePressed", x, y, button: "left", clickCount: 2 
                    });
                    await this.cmd("Input.dispatchMouseEvent", { 
                        type: "mouseReleased", x, y, button: "left", clickCount: 2 
                    });
                }
            });

            return `Clicked element ${uid} at ${Math.round(x)},${Math.round(y)}${dblClick ? ' (Double Click)' : ''}`;

        } catch (e) {
            const isOccluded = e.message === "OCCLUSION_DETECTED";
            const reason = isOccluded ? "Occluded" : e.message;
            
            console.warn(`Physical click on ${uid} failed (${reason}), attempting Enhanced JS fallback.`);
            
            // Enhanced JS Fallback:
            // 1. Simulates complete event chain (mouseover -> mousedown -> mouseup -> click)
            // 2. Forces bubbling to support frameworks (React, etc.)
            // 3. Enables composed events to penetrate ShadowDOM
            
            // We use waitHelper here too to catch navigation triggered by JS click
            await this.waitHelper.execute(async () => {
                await this.cmd("Runtime.callFunctionOn", {
                    objectId: objectId,
                    functionDeclaration: `function() { 
                        // 1. Ensure visibility
                        this.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
                        
                        // 2. Dispatch complete event chain (bubbling + composed enabled)
                        const rect = this.getBoundingClientRect();
                        const x = rect.left + (rect.width / 2);
                        const y = rect.top + (rect.height / 2);
                        
                        const eventTypes = ['mouseover', 'mousedown', 'mouseup', 'click'];
                        
                        eventTypes.forEach(type => {
                             const event = new MouseEvent(type, {
                                 view: window,
                                 bubbles: true,
                                 cancelable: true,
                                 composed: true, // Penetrate ShadowDOM
                                 buttons: 1,
                                 clientX: x,
                                 clientY: y
                             });
                             this.dispatchEvent(event);
                        });
                        
                        // 3. Focus (if focusable)
                        if (this.focus) this.focus();
                    }`
                });
            });

            return `Clicked element ${uid} (${isOccluded ? 'Occluded, ' : ''}JS Fallback)`;
        }
    }

    async dragElement({ from_uid, to_uid }) {
        if (!from_uid || !to_uid) return "Error: 'from_uid' and 'to_uid' are required.";
        
        try {
            // Get ObjectIds
            const fromObjectId = await this.getObjectIdFromUid(from_uid);
            const toObjectId = await this.getObjectIdFromUid(to_uid);
            
            // Helper to get coordinates
            const getCoords = async (backendNodeId, objId) => {
                await this.cmd("DOM.scrollIntoViewIfNeeded", { objectId: objId });
                const { model } = await this.cmd("DOM.getBoxModel", { backendNodeId });
                return {
                    x: (model.content[0] + model.content[4]) / 2,
                    y: (model.content[1] + model.content[5]) / 2
                };
            };

            const fromCoords = await getCoords(
                this.snapshotManager.getBackendNodeId(from_uid),
                fromObjectId
            );
            
            const toCoords = await getCoords(
                this.snapshotManager.getBackendNodeId(to_uid),
                toObjectId
            );

            await this.waitHelper.execute(async () => {
                // 1. Start at From
                await this.cmd("Input.dispatchMouseEvent", { type: "mouseMoved", x: fromCoords.x, y: fromCoords.y });
                await this.cmd("Input.dispatchMouseEvent", { type: "mousePressed", x: fromCoords.x, y: fromCoords.y, button: "left", clickCount: 1 });
                
                // 2. Move Steps
                const steps = 10;
                for (let i = 1; i <= steps; i++) {
                    const x = fromCoords.x + (toCoords.x - fromCoords.x) * (i / steps);
                    const y = fromCoords.y + (toCoords.y - fromCoords.y) * (i / steps);
                    await this.cmd("Input.dispatchMouseEvent", { type: "mouseMoved", x: x, y: y, button: "left" });
                    await new Promise(r => setTimeout(r, 50));
                }

                // 3. Release at To
                await this.cmd("Input.dispatchMouseEvent", { type: "mouseReleased", x: toCoords.x, y: toCoords.y, button: "left", clickCount: 1 });
            });

            return `Dragged element ${from_uid} to ${to_uid}.`;
        } catch (e) {
            return `Error dragging element: ${e.message}`;
        }
    }

    async hoverElement({ uid }) {
        const objectId = await this.getObjectIdFromUid(uid);
        const backendNodeId = this.snapshotManager.getBackendNodeId(uid);

        try {
            await this.cmd("DOM.scrollIntoViewIfNeeded", { objectId });
            const { model } = await this.cmd("DOM.getBoxModel", { backendNodeId });
            
            const x = (model.content[0] + model.content[4]) / 2;
            const y = (model.content[1] + model.content[5]) / 2;

            await this.waitHelper.waitForStableDOM(1000, 200); 

            await this.cmd("Input.dispatchMouseEvent", {
                type: "mouseMoved", x, y
            });

            return `Hovered element ${uid}`;
        } catch (e) {
            return `Error hovering element ${uid}: ${e.message}`;
        }
    }
}
