# Nabi-TS

🚀 **Generating TypeScript code from ABI JSON definitions**

Nabi-TS is a tool that automatically generates type-safe TypeScript code from ABI (Application Binary Interface) JSON files, making your smart contract interactions safer and more efficient.

## ✨ Features

- 🔧 **CLI Tool** - Command-line interface supporting batch processing and automated workflows
- 🌐 **Web Explorer** - Vue 3-based visual interface for real-time code preview
- 🎯 **Type Safety** - Generates fully typed TypeScript code

## 📦 Installation

### Global Installation

```bash
# Using npm
npm install -g nabi-ts

# Using bun
bun install -g nabi-ts
```

### Local Development

```bash
# Clone repository
git clone <repository-url>
cd nabi-ts

# Install dependencies
bun install

# Build project
bun run build:cli
```

## 🚀 Quick Start

### CLI Usage

```bash
# Basic usage
nabi-ts <abi-file.json> [output-directory]

# Examples
nabi-ts contract.json ./generated
nabi-ts my-abi.json ./src/types
```

### Web Explorer

```bash
# Start development server
bun run dev:explorer

# Build production version
bun run build:explorer
```

## 📖 Usage Examples

### 1. Prepare ABI JSON File

```json
{
  "types": {
    "MyContract": {
      "type": "struct",
      "fields": [
        {
          "name": "value",
          "type": "u32"
        }
      ]
    }
  }
}
```

### 2. Generate TypeScript Code

```bash
nabi-ts contract.json ./output
```

### 3. Use Generated Code

```typescript
import { MyContract } from './output/contract';

// Type-safe contract interaction
const contract = new MyContract();
```

## 🏗️ Project Structure

```
nabi-ts/
├── packages/
│   ├── cli/                 # Command-line tool
│   │   ├── src/
│   │   │   ├── index.ts     # CLI entry point
│   │   │   ├── generator.ts # Code generator
│   │   │   ├── parser.ts    # ABI parser
│   │   │   └── types.ts     # Type definitions
│   │   └── package.json
│   └── explorer/            # Web interface
│       ├── src/
│       │   └── components/  # Vue components
│       └── package.json
├── package.json             # Root configuration
└── README.md
```

## 🛠️ Development

### Available Scripts

```bash
# CLI related
bun run build:cli    # Build CLI tool
bun run start:cli    # Start CLI development mode

# Explorer related
bun run dev:explorer    # Start web development server
bun run build:explorer  # Build web application
```

## 📋 System Requirements

- Node.js 18+ or Bun 1.0+
- TypeScript 5+

## 🔗 Related Links

- [Polkadot Documentation](https://docs.polkadot.network/)
- [TypeScript Official Website](https://www.typescriptlang.org/)
- [Bun Official Website](https://bun.sh/)

## 📞 Support

If you encounter issues or have any questions, please:

- Submit an [Issue](../../issues)
- Check [Discussions](../../discussions)
- Contact maintainers

---

⭐ If this project helps you, please give us a Star!
