const Ajv = require('ajv');
const vscode = require('vscode');
const schema = require('../../spinup.schema.json');

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

function validateConfig(raw) {
  if (!validate(raw)) {
    const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join(', ');
    vscode.window.showErrorMessage(`Spinup: Invalid config: ${errors}`);
    return null;
  }

  const data = raw;

  // Apply defaults
  const commands = {};
  for (const [name, cmd] of Object.entries(data.commands)) {
    commands[name] = {
      command: cmd.command,
      autostart: cmd.autostart ?? true,
      autoRestart: cmd.autoRestart ?? false,
      interactive: cmd.interactive ?? false,
      cwd: cmd.cwd,
      env: cmd.env,
      watch: cmd.watch,
    };
  }

  return { commands };
}

module.exports = { validateConfig };
