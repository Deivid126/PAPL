/**
 * Envia os assets do protocolo (backend/storage) para o Vercel Blob.
 *
 * Os arquivos são estáticos e iguais em qualquer instalação: as figuras
 * usadas nas tarefas do protocolo. Ficam fora do git e são servidos pela
 * CDN do Blob, de onde o frontend os lê via VITE_STORAGE_URL.
 *
 * Uso:
 *   node --env-file=.env.local upload-storage.mjs [--dry-run]
 *
 * A chave de cada arquivo preserva o caminho relativo a backend/storage
 * (o imageKey gravado no banco pelo seed), sob BLOB_PREFIX. O prefixo
 * mantém estes assets separados dos de outros projetos que compartilhem
 * o mesmo Blob store.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { put } from '@vercel/blob';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SOURCE = join(ROOT, 'backend', 'storage');
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = 8;
const PREFIX = (process.env.BLOB_PREFIX ?? 'papl').replace(/^\/+|\/+$/g, '');

const CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function keyFor(file) {
  // Chaves do Blob usam "/" em qualquer plataforma.
  const rel = relative(SOURCE, file).split(sep).join('/');
  return PREFIX ? `${PREFIX}/${rel}` : rel;
}

function contentTypeFor(key) {
  const ext = key.slice(key.lastIndexOf('.')).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token && !DRY_RUN) {
    console.error(
      'Erro: defina BLOB_READ_WRITE_TOKEN (Vercel > Storage > seu Blob store > Tokens).',
    );
    process.exit(1);
  }

  try {
    await stat(SOURCE);
  } catch {
    console.error(`Erro: diretório de origem não encontrado: ${SOURCE}`);
    process.exit(1);
  }

  const files = await collect(SOURCE);
  if (files.length === 0) {
    console.error(`Erro: nenhum arquivo em ${SOURCE}.`);
    process.exit(1);
  }

  const total = files.reduce((acc, f) => acc + 1, 0);
  console.log(
    `${total} arquivo(s) em backend/storage -> prefixo "${PREFIX || '(raiz)'}"` +
      `${DRY_RUN ? ' (dry-run)' : ''}`,
  );

  if (DRY_RUN) {
    for (const file of files.slice(0, 10)) console.log(`  ${keyFor(file)}`);
    if (files.length > 10) console.log(`  ... e mais ${files.length - 10}`);
    return;
  }

  let done = 0;
  let base = null;
  const failures = [];
  const queue = [...files];

  async function worker() {
    for (let file = queue.pop(); file; file = queue.pop()) {
      const key = keyFor(file);
      try {
        const body = await readFile(file);
        const result = await put(key, body, {
          access: 'public',
          addRandomSuffix: false,
          contentType: contentTypeFor(key),
          token,
        });
        // A base é igual para todos; basta derivar de um resultado.
        base ??= result.url.slice(0, result.url.length - key.length - 1);
        done += 1;
        if (done % 25 === 0 || done === total) console.log(`  ${done}/${total}`);
      } catch (err) {
        failures.push({ key, message: err?.message ?? String(err) });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (failures.length > 0) {
    console.error(`\n${failures.length} falha(s):`);
    for (const f of failures.slice(0, 20)) console.error(`  ${f.key}: ${f.message}`);
    process.exitCode = 1;
  }

  if (base) {
    // O frontend monta a URL como `${VITE_STORAGE_URL}/${imageKey}`, e o
    // imageKey vem do banco sem o prefixo — logo o prefixo entra na base.
    const storageUrl = PREFIX ? `${base}/${PREFIX}` : base;
    console.log(`\nEnviados: ${done}/${total}`);
    console.log(`\nDefina no projeto do frontend na Vercel:\n  VITE_STORAGE_URL=${storageUrl}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
