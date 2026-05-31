import ts from "typescript";
import fs from "fs";

const file = "src/components/CookDashboard.tsx";
const content = fs.readFileSync(file, "utf8");

const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
);

function printErrors(node) {
    // If it's a JsxElement, check its opening and closing tags match
    if (ts.isJsxElement(node)) {
        const opening = node.openingElement.tagName.getText();
        const closing = node.closingElement.tagName.getText();
        if (opening !== closing) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.closingElement.getStart());
            console.log(`Mismatch! Opened <${opening}> but closed with </${closing}> at line ${line + 1}`);
        }
    }
    ts.forEachChild(node, printErrors);
}

printErrors(sourceFile);
