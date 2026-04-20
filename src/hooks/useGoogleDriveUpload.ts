import { useState, useCallback, useRef } from 'react';

const FOLDER_ID = '1RudAGfciHhJtHdpfCFR7imO52q7c6WhN';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

declare global {
  interface Window {
    google: any;
  }
}

export function useGoogleDriveUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const accessTokenRef = useRef<string | null>(null);

  const getAccessToken = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services não carregado. Recarregue a página.'));
        return;
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        reject(new Error('VITE_GOOGLE_CLIENT_ID não configurado no .env'));
        return;
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
          } else {
            accessTokenRef.current = response.access_token;
            resolve(response.access_token);
          }
        },
      });

      tokenClient.requestAccessToken({ prompt: accessTokenRef.current ? '' : 'consent' });
    });
  }, []);

  const uploadToDrive = useCallback(async (file: File): Promise<string> => {
    setUploading(true);
    setProgress(0);

    try {
      const token = accessTokenRef.current || await getAccessToken();

      const initRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': file.type,
            'X-Upload-Content-Length': String(file.size),
          },
          body: JSON.stringify({
            name: file.name,
            parents: [FOLDER_ID],
          }),
        }
      );

      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Erro ao iniciar upload no Drive');
      }

      const uploadUrl = initRes.headers.get('Location');
      if (!uploadUrl) throw new Error('URL de upload não retornada pelo Drive');

      const CHUNK_SIZE = 5 * 1024 * 1024;
      let offset = 0;
      let fileId = '';

      while (offset < file.size) {
        const end = Math.min(offset + CHUNK_SIZE - 1, file.size - 1);
        const chunk = file.slice(offset, end + 1);

        const res = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Range': `bytes ${offset}-${end}/${file.size}`,
            'Content-Type': file.type,
          },
          body: chunk,
        });

        if (res.status === 200 || res.status === 201) {
          const data = await res.json();
          fileId = data.id;
        } else if (res.status !== 308) {
          throw new Error(`Erro durante upload (status ${res.status})`);
        }

        offset += CHUNK_SIZE;
        setProgress(Math.min(99, Math.round((offset / file.size) * 100)));
      }

      if (!fileId) throw new Error('ID do arquivo não retornado pelo Drive');

      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });

      setProgress(100);
      return `https://drive.google.com/file/d/${fileId}/view`;
    } finally {
      setUploading(false);
    }
  }, [getAccessToken]);

  return { uploadToDrive, uploading, progress };
}
