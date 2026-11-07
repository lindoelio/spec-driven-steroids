# CLI Checks

Command-line interface validation for tools, scripts, and console applications.

## CLI Domain Signals

- `package.json` with CLI frameworks (commander, yargs, inquirer, oclif)
- Presence of `bin/` directory or `bin` field in package.json
- `cli/` directory or file path prefix
- `Makefile` with install/uninstall targets
- Python: `setup.py` with `console_scripts` entry points
- Go: `cmd/` directory with main packages
- Rust: `src/bin/` or `src/main.rs` with CLI argument parsing

## New CLI Tool Detection

When detecting a NEW CLI tool (change type should be `feat`):

```
Signs of new CLI tool:
- First file in cli/ directory
- bin/ directory with new executable
- package.json adding new bin entry
- .c files with main() function and argument parsing
```

**For new tools, check:**
- Dependencies are declared (not just used in code)
- Package.json has bin entry if npm-published
- Executable permissions set
- Help and version flags work

## CLI-Specific Check Categories

### 1. Argument Parsing Validation

```
- All CLI arguments have descriptions
- Required vs optional arguments are correctly marked
- Argument types are validated (number vs string vs boolean)
- Environment variables are documented
- Help text is present and accurate
- Version flag (--version) works
- Help flag (-h, --help) works
```

### 2. Exit Code Compliance

```
- Success cases return 0
- User errors return 1 (invalid input, missing args)
- System errors return 2 (file not found, permission denied)
- All code paths return explicit exit codes
- No unhandled promise rejections
```

### 3. Input Handling

```
- Stdin is handled gracefully when not needed
- File arguments verify file exists before processing
- URLs are validated before fetching
- Large input streams are handled without memory blowup
- EOF is handled correctly for stdin
```

### 4. Output Formatting

```
- stdout vs stderr is correctly separated
- Output format is consistent (JSON, text, etc.)
- No ANSI codes in non-TTY output (piping)
- Progress bars work correctly in TTY
- Colored output respects NO_COLOR / --no-color
```

### 5. Installation/Deployment

```
- Executable bit is set on scripts
- Shebang line is correct (#!/usr/bin/env python3)
- install/uninstall targets work correctly
- Desktop file is valid (Linux)
- PATH installation works correctly
```

## Quick CLI Checks

Run these first (fast, high signal):

```bash
# Verify help works
<cli-tool> --help

# Verify version works
<cli-tool> --version

# Verify exits with 0 on success
echo "test" | <cli-tool>

# Verify exits with 1 on bad input
<cli-tool> --invalid-flag
echo $?  # Should be 1
```

## CLI Check Examples

### Example: Commander.js Check

```javascript
// bin/mytool.js
#!/usr/bin/env node
const { program } = require('commander');

program
  .name('mytool')
  .description('CLI tool description')
  .version('1.0.0')
  .option('-f, --file <path>', 'input file', 'stdin')
  .option('-v, --verbose', 'verbose output')
  .parse();
```

**Check清单:**
- [ ] Name, description, version all present
- [ ] Each option has short flag, long flag, description, default
- [ ] `parse()` is called
- [ ] Shebang is correct

### Example: Python Click Check

```python
# mytool/__main__.py
import click

@click.command()
@click.option('--file', '-f', default='stdin', help='Input file')
@click.option('--verbose', '-v', is_flag=True, help='Verbose output')
@click.version_option(version='1.0.0')
def cli(file, verbose):
    """CLI tool description."""
    pass
```

**Check清单:**
- [ ] `@click.command()` decorator present
- [ ] All options have help text
- [ ] Version option present
- [ ] Docstring describes the command

## Common CLI Bugs

| Bug | Symptom | Check |
|-----|---------|-------|
| Missing `parse()` | CLI hangs | Commander requires `program.parse()` |
| Wrong shebang | `command not found` | Must be `#!/usr/bin/env` not `#!/bin/env` |
| No exit on error | Silent failures | Explicit `process.exit(1)` on errors |
| Swallowed errors | Tool appears to work | All catch blocks log or re-raise |
| Missing `await` | Race conditions | Async CLI must `await` all promises |
| Default behavior broken | No output when flags ommitted | Test with no flags, verify defaults apply |
| Empty input silent | No output for empty stdin | Handle empty input explicitly |

## Default Behavior Testing

Always test default behavior (no flags):

```bash
# Should output something even with no flags
echo "test" | cli-tool

# If help says -a is default, verify it works
cli-tool  # no flags
```

**Check:** If help text says a flag is the default, verify the code implements it.
