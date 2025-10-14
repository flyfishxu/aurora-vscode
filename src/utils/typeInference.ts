// Type inference utilities

export function inferType(expr: string): string {
    expr = expr.trim();
    
    // Integer literal
    if (/^\d+$/.test(expr)) return 'int';
    
    // Double literal
    if (/^\d+\.\d*$/.test(expr) || /^\.\d+$/.test(expr)) return 'double';
    
    // Boolean literal
    if (expr === 'true' || expr === 'false') return 'bool';
    
    // String literal
    if (/^".*"$/.test(expr)) return 'string';
    
    // Null
    if (expr === 'null') return 'null';
    
    // Default to double for complex expressions
    return 'double';
}

export function isTypeCompatible(actual: string, expected: string): boolean {
    // Exact match
    if (actual === expected) return true;
    
    // Numeric compatibility
    if ((actual === 'int' || actual === 'double') && (expected === 'int' || expected === 'double')) {
        return true;
    }
    
    // Null compatibility with optional types
    if (actual === 'null' && expected.endsWith('?')) return true;
    
    return false;
}

