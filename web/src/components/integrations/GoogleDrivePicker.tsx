import { useRef, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { HardDrive, Loader2 } from "lucide-react";
import type { TaskAttachment } from "@/lib/types";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY ?? "";
const APP_ID = import.meta.env.VITE_GOOGLE_APP_ID ?? "";

const SCOPES = "https://www.googleapis.com/auth/drive.file";

interface GoogleDrivePickerProps {
  onFilePicked: (attachment: Omit<TaskAttachment, "id" | "addedBy" | "addedAt">) => void;
  disabled?: boolean;
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

let gisLoaded = false;
let pickerLoaded = false;

async function ensureGapiLoaded(): Promise<void> {
  if (!pickerLoaded) {
    await loadScript("https://apis.google.com/js/api.js", "gapi-script");
    await new Promise<void>((resolve) => {
      gapi.load("picker", () => {
        pickerLoaded = true;
        resolve();
      });
    });
  }
  if (!gisLoaded) {
    await loadScript("https://accounts.google.com/gsi/client", "gis-script");
    gisLoaded = true;
  }
}

export default function GoogleDrivePicker({ onFilePicked, disabled }: GoogleDrivePickerProps) {
  const [loading, setLoading] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const callbackRef = useRef(onFilePicked);
  callbackRef.current = onFilePicked;

  const createPicker = useCallback((accessToken: string) => {
    // Radix modal sets pointer-events:none on body — temporarily override
    // so the Google Picker iframe can receive clicks
    document.body.style.pointerEvents = "auto";

    const view = new google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    const picker = new google.picker.PickerBuilder()
      .setAppId(APP_ID)
      .setOAuthToken(accessToken)
      .addView(view)
      .addView(new google.picker.DocsUploadView())
      .setCallback((data: google.picker.ResponseObject) => {
        // Restore pointer-events on pick or cancel
        if (data.action === google.picker.Action.PICKED || data.action === google.picker.Action.CANCEL) {
          document.body.style.pointerEvents = "";
        }
        if (data.action === google.picker.Action.PICKED) {
          for (const doc of data.docs) {
            callbackRef.current({
              type: "google_drive",
              name: doc.name ?? "Untitled",
              url: doc.url ?? `https://drive.google.com/file/d/${doc.id}/view`,
              mimeType: doc.mimeType,
              iconUrl: doc.iconUrl,
            });
          }
        }
      })
      .build();

    if (API_KEY) {
      picker.setApiKey?.(API_KEY);
    }

    picker.setVisible(true);
  }, []);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      await ensureGapiLoaded();

      // If we already have a token, reuse it
      if (tokenRef.current) {
        createPicker(tokenRef.current);
        setLoading(false);
        return;
      }

      // Unlock pointer-events for OAuth popup too
      document.body.style.pointerEvents = "auto";

      // Request OAuth token via GIS
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: { access_token?: string; error?: string }) => {
          setLoading(false);
          if (response.error || !response.access_token) {
            console.error("OAuth error:", response.error);
            return;
          }
          tokenRef.current = response.access_token;
          createPicker(response.access_token);
        },
      });

      tokenClient.requestAccessToken({ prompt: "" });
    } catch (err) {
      console.error("Failed to load Google Picker:", err);
      setLoading(false);
    }
  }, [createPicker]);

  const isConfigured = !!CLIENT_ID && !!APP_ID;

  if (!isConfigured) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <HardDrive className="h-4 w-4" />
        Google Drive (not configured)
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" disabled={disabled || loading} onClick={handleClick} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
      Google Drive
    </Button>
  );
}

// Type declarations for Google Picker API & GIS
declare global {
  const gapi: {
    load: (api: string, callback: () => void) => void;
  };
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace google {
    namespace picker {
      class PickerBuilder {
        setAppId(id: string): PickerBuilder;
        setOAuthToken(token: string): PickerBuilder;
        addView(view: DocsView | DocsUploadView): PickerBuilder;
        setCallback(cb: (data: ResponseObject) => void): PickerBuilder;
        build(): Picker;
      }
      class DocsView {
        setIncludeFolders(v: boolean): DocsView;
        setSelectFolderEnabled(v: boolean): DocsView;
      }
      class DocsUploadView {}
      interface Picker {
        setVisible(v: boolean): void;
        setApiKey?(key: string): void;
      }
      interface ResponseObject {
        action: string;
        docs: Array<{
          id: string;
          name: string;
          url: string;
          mimeType: string;
          iconUrl: string;
        }>;
      }
      const Action: { PICKED: string; CANCEL: string };
    }
    namespace accounts {
      namespace oauth2 {
        function initTokenClient(config: {
          client_id: string;
          scope: string;
          callback: (response: { access_token?: string; error?: string }) => void;
        }): { requestAccessToken: (opts: { prompt: string }) => void };
      }
    }
  }
}
