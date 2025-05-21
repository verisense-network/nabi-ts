# nabi-ts (WIP)

Generate TypeScript Code Tool From Nucleus ABI JSON

## Introduction

`nabi-ts` is a command-line tool that converts Rust ABI JSON format to TypeScript code. The tool generates TypeScript code(.ts), making it easier to use Rust exported APIs in frontend projects.

## Installation

```bash
# Use npm to install
npm install -g nabi-ts

# Or use bun to install
bun install -g nabi-ts
```

## Usage

```bash
nabi-ts <json-file> [output-dir]
```

Parameters:

- `<json-file>`: ABI JSON file path
- `[output-dir]`: Output directory (default to current directory's output folder)

## Example

```bash
nabi-ts transfer ./data/data.json
```

This will read the `data.json` file and generate the following files in the `./output` directory:

- `data.ts`: TypeScript code

## Development

```bash
# Clone the repository
git clone https://github.com/verisense-network/nabi-ts.git
cd nabi-ts

# Install dependencies
bun install

# Build the project
bun run build

# Run locally
bun run transfer ./data/data.json
```

This project was created using `bun init` in bun v1.2.13. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
