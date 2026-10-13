import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, mkdirSync, statSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

export interface BlobObject {
  key: string;
  stream: Readable;
  contentType: string;
  size: number;
}

export abstract class BlobStorage {
  abstract put(key: string, data: Buffer, contentType: string): Promise<string>;
  abstract get(key: string): Promise<BlobObject | null>;
  abstract getPublicUrl(key: string): string;
  abstract delete(key: string): Promise<void>;
}

/**
 * Implementação local: grava arquivos em um diretório (BLOB_LOCAL_DIR)
 * e expõe via rota GET /storage/:key. Ideal para desenvolvimento.
 */
@Injectable()
export class LocalBlobStorage extends BlobStorage {
  private readonly logger = new Logger('LocalBlobStorage');
  private readonly dir: string;
  private readonly publicBase: string;

  constructor(config: ConfigService) {
    super();
    this.dir = resolve(config.get<string>('BLOB_LOCAL_DIR') ?? './storage');
    this.publicBase = config.get<string>('BLOB_PUBLIC_BASE') ?? 'http://localhost:3000';
    mkdirSync(this.dir, { recursive: true });
  }

  private safeKey(key: string): string {
    if (key.includes('..') || key.startsWith('/') || key.startsWith('\\')) {
      throw new BadRequestException('Chave de blob inválida.');
    }
    return key;
  }

  private pathOf(key: string): string {
    return join(this.dir, this.safeKey(key));
  }

  async put(key: string, data: Buffer, _contentType: string): Promise<string> {
    const target = this.pathOf(key);
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, data);
    this.logger.log(`Blob salvo: ${key}`);
    return this.getPublicUrl(key);
  }

  async get(key: string): Promise<BlobObject | null> {
    const target = this.pathOf(key);
    if (!existsSync(target)) return null;
    const stat = statSync(target);
    return {
      key,
      stream: createReadStream(target),
      contentType: contentTypeFromKey(key),
      size: stat.size,
    };
  }

  async delete(key: string): Promise<void> {
    const target = this.pathOf(key);
    if (existsSync(target)) {
      const { unlink } = await import('fs/promises');
      await unlink(target);
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicBase}/storage/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  /** Roteia o stream de um arquivo para o response do Express. */
  async streamToResponse(key: string, res: any): Promise<boolean> {
    const target = this.pathOf(key);
    if (!existsSync(target)) return false;
    res.setHeader('Content-Type', contentTypeFromKey(key));
    res.setHeader('Content-Length', statSync(target).size);
    await pipeline(createReadStream(target), res);
    return true;
  }
}

/**
 * Adaptador para Amazon S3 (ou compatível via endpoint). Requer
 * BLOB_DRIVER=s3 e as variáveis de credenciais AWS/S3 no .env.
 */
@Injectable()
export class S3BlobStorage extends BlobStorage {
  private readonly logger = new Logger('S3BlobStorage');
  private readonly bucket: string;
  private readonly s3: any;

  constructor(config: ConfigService) {
    super();
    this.bucket = config.get<string>('S3_BUCKET') ?? '';
    const { S3Client } = require('@aws-sdk/client-s3');
    this.s3 = new S3Client({
      region: config.get<string>('S3_REGION') ?? 'us-east-1',
      endpoint: config.get<string>('S3_ENDPOINT') || undefined,
      credentials: {
        accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });
    if (!this.bucket) {
      this.logger.warn('S3_BUCKET não configurado. O storage S3 estará inativo.');
    }
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
    return this.getPublicUrl(key);
  }

  async get(key: string): Promise<BlobObject | null> {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    try {
      const result = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        key,
        stream: Readable.from(result.Body as any),
        contentType: result.ContentType ?? 'application/octet-stream',
        size: Number(result.ContentLength ?? 0),
      };
    } catch (e: any) {
      if (e?.name === 'NoSuchKey') return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  getPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }
}

/**
 * Adaptador para Azure Blob Storage. Requer BLOB_DRIVER=azure e
 * AZURE_CONNECTION_STRING/AZURE_CONTAINER no .env.
 */
@Injectable()
export class AzureBlobStorage extends BlobStorage {
  private readonly logger = new Logger('AzureBlobStorage');
  private readonly container: string;
  private readonly client: any;

  constructor(config: ConfigService) {
    super();
    const { BlobServiceClient } = require('@azure/storage-blob');
    this.container = config.get<string>('AZURE_CONTAINER') ?? '';
    const conn = config.get<string>('AZURE_CONNECTION_STRING') ?? '';
    this.client = BlobServiceClient.fromConnectionString(conn);
  }

  private getContainer() {
    return this.client.getContainerClient(this.container);
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const block = this.getContainer().getBlockBlobClient(key);
    await block.upload(data, data.length, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    return this.getPublicUrl(key);
  }

  async get(key: string): Promise<BlobObject | null> {
    const block = this.getContainer().getBlockBlobClient(key);
    const exists = await block.exists();
    if (!exists) return null;
    const download = await block.download();
    return {
      key,
      stream: (download.readableStreamBody ?? Readable.from([])) as Readable,
      contentType: download.contentType ?? 'application/octet-stream',
      size: Number(download.contentLength ?? 0),
    };
  }

  async delete(key: string): Promise<void> {
    await this.getContainer().getBlockBlobClient(key).deleteIfExists();
  }

  getPublicUrl(key: string): string {
    return this.getContainer().getBlockBlobClient(key).url;
  }
}

function contentTypeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    json: 'application/json',
  };
  return map[ext] ?? 'application/octet-stream';
}

/**
 * Fábrica do driver de blob storage baseada em BLOB_DRIVER.
 */
export function createBlobStorage(config: ConfigService): BlobStorage {
  const driver = config.get<string>('BLOB_DRIVER') ?? 'local';
  switch (driver) {
    case 's3':
      return new S3BlobStorage(config);
    case 'azure':
      return new AzureBlobStorage(config);
    default:
      return new LocalBlobStorage(config);
  }
}