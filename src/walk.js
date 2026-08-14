// --------------------------------------------------
// GET DECLARATION NAME
// --------------------------------------------------
// 1-Receives a Tree-sitter syntax tree node.
// 2-Gets the node's "name" field.
// 3-Checks whether a name node exists.
// 4-If a name node exists, returns its text.
// 5-If no name node exists, returns "<anonymous>".
// --------------------------------------------------
function getDeclarationName(node) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
        return nameNode.text;
    }
    return "<anonymous>";
}

// --------------------------------------------------
// CREATE DECLARATION
// --------------------------------------------------
// 1-Receives a Tree-sitter syntax tree node.
// 2-Receives the declaration name.
// 3-Receives the declaration kind.
// 4-Receives any declaration modifiers.
// 5-Creates the identity parts using the declaration name and kind.
// 6-Checks whether the declaration has the "static" modifier.
// 7-Adds "static" to the identity when required.
// 8-Creates a declaration object.
// 9-Stores the original Tree-sitter node type.
// 10-Stores the declaration kind.
// 11-Stores the declaration name.
// 12-Stores the declaration modifiers.
// 13-Creates a unique identity for the declaration.
// 14-Stores the starting character index of the declaration.
// 15-Stores the ending character index of the declaration.
// 16-Stores the starting line of the declaration.
// 17-Stores the starting column of the declaration.
// 18-Stores the ending line of the declaration.
// 19-Stores the ending column of the declaration.
// 20-Extracts and stores the properties belonging to the declaration.
// 21-Returns the completed declaration object.
// --------------------------------------------------

function createDeclaration(node, name = getDeclarationName(node), kind = node.type, modifiers = []) {
    const identityParts = [
        name,
        kind
    ];

    if (modifiers.includes("static")) {
        identityParts.push("static");
    }
    return {
        type: node.type,
        kind,
        name,
        modifiers,
        identity: identityParts.join(":"),
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        startLine: node.startPosition.row + 1,
        startColumn: node.startPosition.column,
        endLine: node.endPosition.row + 1,
        endColumn: node.endPosition.column,
        properties: extractProperties(node)
    };
}


// --------------------------------------------------
// WALK
// --------------------------------------------------
// 1-Receives the current Tree-sitter syntax tree node.
// 2-Receives the current scope.
// 3-Receives the declarations array.
// 4-Uses an empty array as the default scope.
// 5-Uses an empty array as the default declarations list.
// 6-Copies the current scope into currentScope.
// 7-Checks whether the current node is a class declaration.
// 8-Gets the class name.
// 9-Ignores the class if it is anonymous.
// 10-Creates the qualified class name using the current scope.
// 11-Creates and stores the class declaration.
// 12-Updates the scope to include the class name.
// 13-Checks whether the current node is a variable declarator.
// 14-Gets the variable name.
// 15-Gets the value assigned to the variable.
// 16-Checks whether the variable contains an object.
// 17-If it contains an object, adds the variable name to the current scope.
// 18-Checks whether the variable contains a class.
// 19-Creates and stores the class declaration.
// 20-Updates the scope to include the class name.
// 21-Checks whether the variable contains an arrow function or function expression.
// 22-Creates and stores the function declaration.
// 23-Updates the scope to include the function name.
// 24-Checks whether the current node is a normal or generator function declaration.
// 25-Gets the function name.
// 26-Ignores the function if it is anonymous.
// 27-Creates the qualified function name using the current scope.
// 28-Creates and stores the function declaration.
// 29-Updates the scope to include the function name.
// 30-Checks whether the current node is a named function expression.
// 31-Gets the function name.
// 32-Gets the type of the parent node.
// 33-Checks whether the function is already bound to another declaration.
// 34-If it is not already bound, adds the function name to the current scope.
// 35-Checks whether the current node is a method definition.
// 36-Gets the method name.
// 37-Ignores computed property names.
// 38-Gets the types of the method's children.
// 39-Creates an empty list for method modifiers.
// 40-Checks whether the method is static.
// 41-Adds "static" when the method is static.
// 42-Checks whether the method is async.
// 43-Adds "async" when the method is async.
// 44-Checks whether the method is a generator.
// 45-Adds "generator" when the method is a generator.
// 46-Sets the default method kind to "method".
// 47-Changes the kind to "getter" when the method is a getter.
// 48-Changes the kind to "setter" when the method is a setter.
// 49-Creates the qualified method name using the current scope.
// 50-Creates and stores the method declaration.
// 51-Updates the scope to include the method name.
// 52-Checks whether the current node is an object property.
// 53-Gets the property key.
// 54-Gets the property value.
// 55-Ignores computed property names.
// 56-Checks whether the property value is an object.
// 57-If it is an object, adds the property name to the current scope.
// 58-Checks whether the property value is an arrow function or function expression.
// 59-Creates the qualified function name.
// 60-Creates and stores the function declaration.
// 61-Updates the scope to include the property name.
// 62-Checks whether the current node is a class field.
// 63-Gets the class field property.
// 64-Gets the value assigned to the class field.
// 65-Ignores computed property names.
// 66-Checks whether the field value is an arrow function or function expression.
// 67-Creates the qualified function name.
// 68-Creates and stores the function declaration.
// 69-Updates the scope to include the field name.
// 70-Checks whether the current node is an assignment expression.
// 71-Gets the left side of the assignment.
// 72-Gets the right side of the assignment.
// 73-Converts the left expression into readable text.
// 74-Checks whether the assignment is assigning an object.
// 75-If it is an object, adds the left expression to the current scope.
// 76-Checks whether the assignment is assigning an arrow function or function expression.
// 77-Creates the qualified function name.
// 78-Creates and stores the function declaration.
// 79-Updates the scope to include the assigned function name.
// 80-Loops through all named children of the current node.
// 81-Recursively calls walk() for every child.
// 82-Passes the updated scope to each child.
// 83-Passes the same declarations array so all declarations are collected.
// 84-Returns the complete declarations array.
// --------------------------------------------------

export function walk(node, scope = [], declarations = []) {
    let currentScope = scope;
    // CLASS DECLARATION
    if (node.type === "class_declaration") {
        const name = getDeclarationName(node);
        if (name !== "<anonymous>") {
            const qualifiedName = [...scope, name].join(".");
            declarations.push(createDeclaration(node, qualifiedName, "class"));
            currentScope = [...scope, name
            ];
        }
    }

    // VARIABLE DECLARATOR
    if (node.type === "variable_declarator") {
        const name = getDeclarationName(node);
        const value = node.childForFieldName("value");

        // const api = { ... }
        if (value?.type === "object" && name !== "<anonymous>") {
            currentScope = [...scope, name];
        }

        // const MyClass = class { ... }
        if (value?.type === "class" && name !== "<anonymous>") {
            const qualifiedName = [...scope, name].join(".");
            declarations.push(createDeclaration(node, qualifiedName, "class"));
            currentScope = [...scope, name];
        }

        // const handler = () => {}
        // const handler = function () {}
        if ((value?.type === "arrow_function" || value?.type === "function_expression") && name !== "<anonymous>") {
            const qualifiedName = [...scope, name].join(".");
            declarations.push(createDeclaration(node, qualifiedName, "function"));
            currentScope = [...scope, name];
        }
    }

    // NORMAL / GENERATOR FUNCTION
    if (node.type === "function_declaration" || node.type === "generator_function_declaration") {
        const name = getDeclarationName(node);
        if (name !== "<anonymous>") {
            const qualifiedName = [...scope, name].join(".");
            declarations.push(createDeclaration(node, qualifiedName, "function"));
            currentScope = [...scope, name];
        }
    }

    // NAMED FUNCTION EXPRESSION
    if (node.type === "function_expression") {
        const name = getDeclarationName(node);
        const parentType = node.parent?.type;
        const alreadyBound = parentType === "variable_declarator" || parentType === "pair" || parentType === "field_definition" || parentType === "assignment_expression";

        if (name !== "<anonymous>" && !alreadyBound) {
            currentScope = [...scope, name];
        }
    }

    // METHOD
    if (node.type === "method_definition") {
        const nameNode = node.childForFieldName("name");
        if (nameNode && nameNode.type !== "computed_property_name") {
            const name = nameNode.text;
            const childTypes = node.children.map(child => child.type);
            const modifiers = [];
            if (childTypes.includes("static")) {
                modifiers.push("static");
            }
            if (childTypes.includes("async")) {
                modifiers.push("async");
            }
            if (childTypes.includes("*")) {
                modifiers.push("generator");
            }
            let kind = "method";
            if (childTypes.includes("get")) {
                kind = "getter";
            }
            else if (childTypes.includes("set")) {
                kind = "setter";
            }
            const qualifiedName = [...scope, name].join(".");
            declarations.push(createDeclaration(node, qualifiedName, kind, modifiers)
            );
            currentScope = [...scope, name];
        }
    }

    // OBJECT PROPERTY
    if (node.type === "pair") {
        const key = node.childForFieldName("key");
        const value = node.childForFieldName("value");

        if (key && key.type !== "computed_property_name") {
            // admin: { ... }
            if (value?.type === "object") {
                currentScope = [...scope, key.text];
            }
            // handler: () => {}
            // handler: function () {}
            if (value && (value.type === "arrow_function" || value.type === "function_expression")) {
                const qualifiedName = [...scope, key.text].join(".");
                declarations.push(createDeclaration(node, qualifiedName, "function"));
                currentScope = [...scope, key.text];
            }
        }
    }

    // CLASS FIELD
    if (node.type === "field_definition") {
        const property = node.childForFieldName("property");
        const value = node.childForFieldName("value");

        if (property && property.type !== "computed_property_name") {
            if (value && (value.type === "arrow_function" || value.type === "function_expression")) {
                const qualifiedName = [...scope, property.text].join(".");
                declarations.push(createDeclaration(node, qualifiedName, "function"));
                currentScope = [...scope, property.text];
            }
        }
    }

    // ASSIGNMENT
    if (node.type === "assignment_expression") {
        const left = node.childForFieldName("left");
        const right = node.childForFieldName("right");
        const leftName = getExpressionText(left);

        // module.exports.admin = { ... }
        if (leftName && right?.type === "object") {
            currentScope = [...scope, leftName];
        }

        // module.exports.handler = () => {}
        if (leftName && right && (right.type === "arrow_function" || right.type === "function_expression")) {
            const qualifiedName = [...scope, leftName].join(".");
            declarations.push(createDeclaration(node, qualifiedName, "function"));
            currentScope = [...scope, leftName
            ];
        }
    }

    // WALK CHILDREN
    // 85-Iterates through all named children of the current node.
    // 86-Recursively passes each child back into walk().
    // 87-Passes the current scope to the child.
    // 88-Passes the shared declarations array to the child.
    // 89-Continues until all nodes in the syntax tree have been visited.
    for (const child of node.namedChildren) {
        walk(child, currentScope, declarations);
    }
    // 90 Returns the complete list of declarations found in the syntax tree.
    return declarations;
}
