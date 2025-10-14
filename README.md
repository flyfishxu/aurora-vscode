# AuroraLang for Visual Studio Code

Official Visual Studio Code extension for [AuroraLang](https://github.com/flyfishxu/AuroraLang) - A modern LLVM-powered programming language with null safety.

## Highlights

- Syntax highlighting, snippets, and command palette integration for AuroraLang
- Null-aware hovers updated to reflect that optional equality/inequality with `null` produces boolean results

## Installation

### From Source
1. Clone this repository
2. Open the `vscode-extension` directory in VSCode
3. Run `npm install`
4. Press F5 to launch the extension in a new VSCode window

### From VSIX (Coming Soon)
1. Download the `.vsix` file from releases
2. In VSCode, go to Extensions view
3. Click "..." menu → "Install from VSIX..."
4. Select the downloaded file

## Usage

### Running AuroraLang Programs

**Method 1: Run Button**
- Open an `.aur` file
- Click the ▶️ Run button in the editor toolbar
- Output appears in the "AuroraLang" output panel

**Method 2: Keyboard Shortcut**
- Open an `.aur` file
- Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)

**Method 3: Command Palette**
- Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
- Type "AuroraLang: Run Current File"

**Method 4: Context Menu**
- Right-click in an `.aur` file
- Select "Run Current File"

### Generating LLVM IR

- Open an `.aur` file
- Right-click → "Emit LLVM IR"
- Or use Command Palette: "AuroraLang: Emit LLVM IR"
- The `.ll` file will be generated and opened

### Debugging (Experimental)

1. Open an `.aur` file
2. Set breakpoints by clicking the left margin
3. Press F5 or go to Run & Debug view
4. Select "Debug AuroraLang File"
5. The debugger will launch

**Note**: Full debugging support requires LLDB integration (work in progress)


## Known Issues

- Debugging support is basic and experimental
- Some semantic errors require compiler check (save file to trigger)

## Roadmap

- [x] Real-time syntax error detection
- [x] Bracket/brace matching
- [x] Function call validation (undefined functions, parameter count/types)
- [x] Class and constructor support
- [x] Basic type checking
- [x] Module system support (import statement)
- [x] Built-in functions (printd, etc.)
- [x] Multi-file project support
- [ ] Full Language Server Protocol (LSP) implementation
- [ ] Advanced debugging with LLDB integration
- [ ] More comprehensive type inference
- [ ] Cross-file symbol resolution
- [x] Auto-formatting (basic)
- [ ] Refactoring tools

## Contributing

Contributions are welcome! Please see the [AuroraLang repository](https://github.com/flyfishxu/AuroraLang) for contribution guidelines.

## License

MIT License - See [LICENSE](LICENSE) for details.

## Links

- [AuroraLang Repository](https://github.com/flyfishxu/AuroraLang)
- [Language Documentation](https://github.com/flyfishxu/AuroraLang/tree/main/docs)
- [Report Issues](https://github.com/flyfishxu/AuroraLang/issues)

---

**Built with ❤️ for AuroraLang**
