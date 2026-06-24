declare module "unzipper" {
  export type UnzipperFile = {
    path: string;
    buffer: () => Promise<Buffer>;
  };

  export type UnzipperDirectory = {
    files: UnzipperFile[];
  };

  export const Open: {
    buffer: (data: Buffer) => Promise<UnzipperDirectory>;
  };
}
