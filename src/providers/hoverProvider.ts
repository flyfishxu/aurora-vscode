// Hover provider for AuroraLang

import * as vscode from 'vscode';

export class AuroraHoverProvider implements vscode.HoverProvider {
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.Hover | null {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return null;
        }

        const word = document.getText(range);
        const text = document.getText();

        // Check for function definitions
        const fnRegex = new RegExp(`fn\\s+${word}\\s*\\([^)]*\\)\\s*(?:->\\s*\\w+\\??)?\\s*\\{`, 'g');
        const fnMatch = fnRegex.exec(text);
        if (fnMatch) {
            const markdown = new vscode.MarkdownString();
            markdown.appendCodeblock(fnMatch[0].replace('{', '').trim(), 'aurora');
            markdown.appendMarkdown('\n\n*Function definition*');
            return new vscode.Hover(markdown);
        }

        // Check for extern functions
        const externRegex = new RegExp(`extern\\s+${word}\\s*\\([^)]*\\)`, 'g');
        const externMatch = externRegex.exec(text);
        if (externMatch) {
            const markdown = new vscode.MarkdownString();
            markdown.appendCodeblock(externMatch[0], 'aurora');
            markdown.appendMarkdown('\n\n*External function*');
            return new vscode.Hover(markdown);
        }

        // Keyword documentation
        const keywordDocs: { [key: string]: string } = {
            'fn': 'Define a function',
            'extern': 'Declare an external function',
            'return': 'Return a value from a function',
            'let': 'Declare an immutable variable',
            'var': 'Declare a mutable variable',
            'if': 'Conditional statement',
            'else': 'Alternative branch of conditional',
            'while': 'While loop',
            'for': 'For loop with range',
            'loop': 'Infinite loop (use break to exit)',
            'break': 'Exit from a loop',
            'continue': 'Skip to next iteration of loop',
            'in': 'Range operator for for loops',
            'class': 'Define a class',
            'new': 'Create a new instance of a class',
            'this': 'Reference to the current instance',
            'int': 'Integer type (64-bit)',
            'double': 'Double-precision floating-point type',
            'bool': 'Boolean type',
            'string': 'String type',
            'void': 'Void type (no return value)',
            'true': 'Boolean true constant',
            'false': 'Boolean false constant',
            'null': 'Null value for optional types'
        };

        if (word in keywordDocs) {
            return new vscode.Hover(keywordDocs[word]);
        }

        return null;
    }
}

