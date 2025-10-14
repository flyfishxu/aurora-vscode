// Completion provider for AuroraLang

import * as vscode from 'vscode';

export class AuroraCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        // Control flow keywords with snippets
        const controlFlowItems: { [key: string]: { snippet: string, doc: string } } = {
            'if': { 
                snippet: 'if ${1:condition} {\n\t$0\n}', 
                doc: 'If conditional statement' 
            },
            'else': { 
                snippet: 'else {\n\t$0\n}', 
                doc: 'Else branch' 
            },
            'while': { 
                snippet: 'while ${1:condition} {\n\t$0\n}', 
                doc: 'While loop' 
            },
            'for': { 
                snippet: 'for ${1:i} in ${2:0}..${3:10} {\n\t$0\n}', 
                doc: 'For loop with range' 
            },
            'loop': { 
                snippet: 'loop {\n\t$0\n}', 
                doc: 'Infinite loop' 
            },
            'fn': { 
                snippet: 'fn ${1:name}(${2:params}) -> ${3|void,int,double,bool,string|} {\n\t$0\n}', 
                doc: 'Function definition with return type' 
            },
            'class': {
                snippet: 'class ${1:ClassName} {\n\t$0\n}',
                doc: 'Class definition'
            }
        };

        Object.entries(controlFlowItems).forEach(([keyword, info]) => {
            const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            item.detail = 'keyword';
            item.documentation = new vscode.MarkdownString(info.doc);
            item.insertText = new vscode.SnippetString(info.snippet);
            completions.push(item);
        });

        // Simple keywords
        const simpleKeywords = ['return', 'let', 'var', 'break', 'continue', 'in', 'match', 'extern', 'new', 'this'];
        simpleKeywords.forEach(keyword => {
            const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            item.detail = 'keyword';
            completions.push(item);
        });

        // Types with optional marker
        const types = ['int', 'double', 'bool', 'string', 'void'];
        types.forEach(type => {
            const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
            item.detail = 'type';
            item.documentation = new vscode.MarkdownString(`Type: \`${type}\`\n\nAdd \`?\` for optional type: \`${type}?\``);
            completions.push(item);
            
            const optionalItem = new vscode.CompletionItem(type + '?', vscode.CompletionItemKind.TypeParameter);
            optionalItem.detail = 'optional type';
            optionalItem.documentation = new vscode.MarkdownString(`Optional (nullable) ${type} type`);
            completions.push(optionalItem);
        });

        // Constants
        const constants = ['true', 'false', 'null'];
        constants.forEach(constant => {
            const item = new vscode.CompletionItem(constant, vscode.CompletionItemKind.Constant);
            item.detail = 'constant';
            completions.push(item);
        });

        // Built-in functions
        const printd = new vscode.CompletionItem('printd', vscode.CompletionItemKind.Function);
        printd.detail = 'extern printd(x)';
        printd.documentation = new vscode.MarkdownString('Print a double value to stdout\n\n**Usage:** `printd(42)`');
        printd.insertText = new vscode.SnippetString('printd(${1:value})');
        completions.push(printd);

        // Parse document for function definitions
        const text = document.getText();
        const functionRegex = /fn\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\w+\??))?\s*\{/g;
        let match;
        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1];
            const params = match[2];
            const returnType = match[3] || 'double';
            
            const item = new vscode.CompletionItem(functionName, vscode.CompletionItemKind.Function);
            item.detail = `fn ${functionName}(${params}) -> ${returnType}`;
            item.documentation = new vscode.MarkdownString('User-defined function');
            item.insertText = new vscode.SnippetString(`${functionName}($1)`);
            completions.push(item);
        }

        // Parse for extern functions
        const externRegex = /extern\s+(\w+)\s*\(([^)]*)\)/g;
        while ((match = externRegex.exec(text)) !== null) {
            const functionName = match[1];
            const params = match[2];
            const item = new vscode.CompletionItem(functionName, vscode.CompletionItemKind.Function);
            item.detail = `extern ${functionName}(${params})`;
            item.documentation = new vscode.MarkdownString('External function');
            item.insertText = new vscode.SnippetString(`${functionName}($1)`);
            completions.push(item);
        }

        // Parse for variables
        const varRegex = /(?:let|var)\s+(\w+)/g;
        const varNames = new Set<string>();
        while ((match = varRegex.exec(text)) !== null) {
            varNames.add(match[1]);
        }
        varNames.forEach(varName => {
            const item = new vscode.CompletionItem(varName, vscode.CompletionItemKind.Variable);
            item.detail = 'variable';
            completions.push(item);
        });

        return completions;
    }
}

