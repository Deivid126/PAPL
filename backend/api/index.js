/**
 * Handler serverless da API na Vercel.
 *
 * É JavaScript puro de propósito: o builder da Vercel compila TypeScript
 * com esbuild, que não emite `emitDecoratorMetadata` — o que quebraria a
 * injeção de dependências do Nest. Então o Nest é compilado por tsc via
 * `nest build` (ver vercel-build) e aqui apenas carregamos o dist.
 *
 * A instância é memorizada entre invocações: enquanto o container da
 * função estiver quente, o Nest não é reconstruído a cada requisição.
 */
require('reflect-metadata');

let appPromise;

function getExpressInstance() {
  if (!appPromise) {
    appPromise = (async () => {
      const { createNestApp } = require('../dist/bootstrap');
      const app = await createNestApp();
      await app.init();
      return app.getHttpAdapter().getInstance();
    })().catch((err) => {
      // Sem isto, uma falha de boot ficaria memorizada e toda requisição
      // seguinte receberia a mesma promise rejeitada, sem nova tentativa.
      appPromise = undefined;
      throw err;
    });
  }
  return appPromise;
}

module.exports = async (req, res) => {
  const express = await getExpressInstance();
  return express(req, res);
};
