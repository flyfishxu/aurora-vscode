// Parsing utilities

import { Parameter } from '../types';

export function parseParameters(paramsStr: string): Parameter[] {
    if (!paramsStr || paramsStr.trim() === '') return [];
    
    const params: Parameter[] = [];
    const paramParts = paramsStr.split(',');
    
    for (const part of paramParts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        
        // Parse "name: type" or just "name"
        const match = trimmed.match(/^(\w+)(?:\s*:\s*(\w+\??))?$/);
        if (match) {
            params.push({
                name: match[1],
                type: match[2] || 'double'
            });
        }
    }
    
    return params;
}

export function parseArguments(argsStr: string): string[] {
    if (!argsStr || argsStr.trim() === '') return [];
    
    const args: string[] = [];
    let depth = 0;
    let current = '';
    
    for (let i = 0; i < argsStr.length; i++) {
        const char = argsStr[i];
        
        if (char === '(') depth++;
        else if (char === ')') depth--;
        else if (char === ',' && depth === 0) {
            if (current.trim()) args.push(current.trim());
            current = '';
            continue;
        }
        
        current += char;
    }
    
    if (current.trim()) args.push(current.trim());
    return args;
}

