# Fallback Providers

These providers are only used when LSP server is not available.

When LSP is active, all language features are provided by the LSP server instead.

## Files
- `diagnostics.ts` - Basic syntax checking
- `completion.ts` - Basic auto-completion
- `hover.ts` - Simple hover information

These are simplified versions compared to the full LSP implementation.


