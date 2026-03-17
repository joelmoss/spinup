const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { parse: parseYaml } = require('yaml');
const { validateConfig } = require('./validator');

class ConfigLoader {
  static async load(workspaceFolder) {
    const root = workspaceFolder.uri.fsPath;

    for (const filename of ['spinup.yml', 'spinup.json']) {
      const filePath = path.join(root, filename);
      if (!fs.existsSync(filePath)) {
        continue;
      }

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const raw = filename.endsWith('.yml') ? parseYaml(content) : JSON.parse(content);
        const config = validateConfig(raw);
        if (config) {
          return config;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Spinup: Failed to parse ${filename}: ${message}`);
        return null;
      }
    }

    return null;
  }

  static getConfigFilePath(workspaceFolder) {
    const root = workspaceFolder.uri.fsPath;
    for (const filename of ['spinup.yml', 'spinup.json']) {
      const filePath = path.join(root, filename);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
    return null;
  }
}

module.exports = { ConfigLoader };
