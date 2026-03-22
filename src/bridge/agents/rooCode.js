const KIND = 'roo-code';
const EXTENSION_ID = 'RooVeterinaryInc.roo-cline';

const EVENT_MAP = {
  'task_started': 'working',
  'task_ended': 'idle',
  'ask': 'waiting_for_input',
};

function getHookConfig() {
  return {
    agent: KIND,
    configPath: null,
    hooks: [],
  };
}

module.exports = { KIND, EXTENSION_ID, EVENT_MAP, getHookConfig };
