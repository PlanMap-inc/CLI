// --------------------------------------------------
// COLOURS THROUGH THE CONTENT SECURITY POLICY
// --------------------------------------------------
// The webview's policy has no 'unsafe-inline' for styles, so a style=""
// attribute that arrives as part of an innerHTML string is parsed and then
// dropped. Everything the interface says with colour travels that way - the
// lens swatch, the bar on a step, the stroke on an edge - so all of it came
// out grey, and nothing in the console said why.
//
// CSP governs markup, not the CSSOM. So the colour rides in as data-style
// and is assigned here, after the markup is in the document. Call this once
// on whatever you just set innerHTML on.
// --------------------------------------------------

export function paint(root) {
    if (!root) return;

    if (root.dataset?.style) {
        root.style.cssText = root.dataset.style;
    }

    root.querySelectorAll?.("[data-style]").forEach(el => {
        el.style.cssText = el.dataset.style;
    });
}
