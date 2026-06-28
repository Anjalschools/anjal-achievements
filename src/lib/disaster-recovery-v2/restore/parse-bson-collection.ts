import { deserialize, serialize } from "bson";

export const parseBsonCollectionFile = (content: Buffer): Record<string, unknown>[] => {
  const documents: Record<string, unknown>[] = [];
  let offset = 0;

  while (offset < content.length) {
    if (offset + 4 > content.length) {
      throw new Error("BSON_COLLECTION_TRUNCATED");
    }

    const documentLength = content.readInt32LE(offset);
    if (documentLength <= 0 || offset + 4 + documentLength > content.length) {
      throw new Error("BSON_COLLECTION_INVALID_LENGTH");
    }

    const documentBytes = content.subarray(offset + 4, offset + 4 + documentLength);
    documents.push(deserialize(documentBytes) as Record<string, unknown>);
    offset += 4 + documentLength;
  }

  return documents;
};

export const serializeDocumentsToBsonFile = (documents: Record<string, unknown>[]): Buffer => {
  const chunks: Buffer[] = [];

  for (const document of documents) {
    const bsonDocument = Buffer.from(serialize(document));
    const header = Buffer.alloc(4);
    header.writeInt32LE(bsonDocument.length, 0);
    chunks.push(header, bsonDocument);
  }

  return Buffer.concat(chunks);
};
