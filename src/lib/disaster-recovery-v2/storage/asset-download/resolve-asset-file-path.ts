import type { StorageDiscoveryAsset } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";

const sanitizePathSegment = (segment: string): string =>
  segment.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "asset";

const resolveFileExtension = (asset: StorageDiscoveryAsset): string => {
  if (asset.contentType?.includes("/")) {
    const subtype = asset.contentType.split("/")[1]?.split(";")[0]?.trim();
    if (subtype && subtype !== "*" && subtype.length > 0) {
      return subtype.startsWith(".") ? subtype : `.${subtype}`;
    }
  }

  const publicIdMatch = asset.publicId.match(/(\.[a-zA-Z0-9]+)$/);
  if (publicIdMatch) {
    return publicIdMatch[1];
  }

  return ".bin";
};

export const resolveAssetRelativePath = (asset: StorageDiscoveryAsset): string => {
  const provider = sanitizePathSegment(asset.provider);
  const folder = asset.folder?.trim() || "_root";
  const folderParts = folder.split("/").filter(Boolean).map(sanitizePathSegment);
  const version = `v${sanitizePathSegment(String(asset.version ?? "latest"))}`;
  const baseName = sanitizePathSegment(asset.publicId.split("/").pop() || asset.publicId || "asset");
  const extension = resolveFileExtension(asset);

  return ["assets", provider, ...folderParts, version, `${baseName}${extension}`].join("/");
};

export const compareAssetsForDownloadOrder = (
  left: StorageDiscoveryAsset,
  right: StorageDiscoveryAsset
): number => {
  const providerOrder = left.provider.localeCompare(right.provider);
  if (providerOrder !== 0) return providerOrder;

  const folderOrder = (left.folder ?? "").localeCompare(right.folder ?? "");
  if (folderOrder !== 0) return folderOrder;

  const publicIdOrder = left.publicId.localeCompare(right.publicId);
  if (publicIdOrder !== 0) return publicIdOrder;

  const versionOrder = String(left.version ?? "latest").localeCompare(String(right.version ?? "latest"));
  if (versionOrder !== 0) return versionOrder;

  return left.storageKey.localeCompare(right.storageKey);
};

export const sortAssetsForDownload = (assets: StorageDiscoveryAsset[]): StorageDiscoveryAsset[] =>
  [...assets].sort(compareAssetsForDownloadOrder);
