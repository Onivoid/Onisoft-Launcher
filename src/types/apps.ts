export type LocalizedText = {
  fr: string;
  en: string;
};

export type AppManifest = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  branding: {
    primaryColor: string;
    logo: string;
  };
  repo: string;
  version: {
    source: string;
    repo: string;
  };
  download: Record<
    string,
    {
      asset: string;
      kind: string;
      match?: string;
    }
  >;
  launch: {
    windows?: { executable: string; candidates?: string[] };
    macos?: { executable: string; candidates?: string[] };
    linux?: { executable: string; candidates?: string[] };
  };
};

export type InstallRecord = {
  version: string;
  executablePath: string;
  kind: string;
  installedAt: string;
};

export type AppInstallDetails = {
  installed: boolean;
  executablePath?: string | null;
  installDir?: string | null;
  installSizeBytes?: number | null;
  cacheSizeBytes: number;
  version?: string | null;
  kind?: string | null;
  installedAt?: string | null;
};

export type AppSummary = {
  id: string;
  manifest: AppManifest;
  remoteVersion?: string | null;
  install?: InstallRecord | null;
  manifestSource: string;
};

export type DownloadProgress = {
  appId: string;
  downloaded: number;
  total?: number | null;
};

export type InstallPhase =
  | "downloading"
  | "installing"
  | "locating"
  | "uninstalling";

export type InstallStatus = {
  appId: string;
  phase: InstallPhase;
};
