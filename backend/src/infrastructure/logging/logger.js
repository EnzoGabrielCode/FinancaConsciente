const winston = require('winston');

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

/**
 * errors({ stack: true }) só trata o Error passado como a própria mensagem.
 * Um Error em meta.error viraria "{}" no JSON, então é convertido aqui. Só
 * name, message e stack são copiados: erros do body-parser, por exemplo,
 * carregam o corpo da requisição em err.body.
 */
const serializeError = winston.format((info) => {
  if (info.error instanceof Error) {
    const { name, message, stack } = info.error;
    info.error = { name, message, stack };
  }
  return info;
});

const readableLine = printf(({ timestamp: time, level, message, ...extras }) => {
  return `${time} ${level}: ${message} ${JSON.stringify(extras)}`;
});

/**
 * Cria o logger da aplicação: JSON de uma linha em produção e texto legível
 * colorido nos demais ambientes. O nível 'silent' desliga a saída (testes).
 */
function createLogger({ level, env }) {
  const baseFormat = [errors({ stack: true }), serializeError(), timestamp()];

  return winston.createLogger({
    level,
    silent: level === 'silent',
    defaultMeta: { service: 'financaconsciente-api' },
    format:
      env === 'production'
        ? combine(...baseFormat, json())
        : combine(...baseFormat, colorize(), readableLine),
    transports: [new winston.transports.Console()],
  });
}

module.exports = { createLogger };
