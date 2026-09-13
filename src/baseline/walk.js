// --------------------------------------------------
// GENERIC TREE TRAVERSAL
// --------------------------------------------------
// Language-neutral traversal mechanics only.
//
// Knows nothing about node types, declarations or naming.
// Language-specific declaration rules live in the walkers
// under ./walkers/.
//
// The visitor receives the current node and the scope
// inherited from its parent, and returns the scope its
// children should inherit.
// --------------------------------------------------

export function walkTree(
    node,
    visit,
    scope = []
) {

    const childScope =
        visit(node, scope) ?? scope;


    for (const child of node.namedChildren) {

        walkTree(
            child,
            visit,
            childScope
        );
    }
}
