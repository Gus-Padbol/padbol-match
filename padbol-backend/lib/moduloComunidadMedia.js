/**
 * Media uploads for Comunidad.
 * Files stay in the private `comunidad-media` bucket. Only the API service
 * role writes there; the client never receives Storage credentials.
 */
const MEDIA_BUCKET = 'comunidad-media';
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime']);

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validPostId(raw) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function safeFileExtension(file) {
  const fromMime = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
  };
  return fromMime[String(file?.mimetype || '').toLowerCase()] || 'bin';
}

/** @param {import('express').Express} app */
export function registerModuloComunidadMediaRoutes(app, deps) {
  const { supabaseAdmin, authUserFromBearer, multer } = deps;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  });

  app.post('/api/comunidad/publicaciones/:id/media', upload.single('media'), async (req, res) => {
    let storagePath = null;
    try {
      const user = await authUserFromBearer(req);
      if (!user?.id) throw httpError('Token inválido o expirado', 401);
      if (!req.file?.buffer) throw httpError('Seleccioná una foto o video.', 400);

      const publicacionId = validPostId(req.params.id);
      if (!publicacionId) throw httpError('Publicación inválida.', 400);

      const mimeType = String(req.file.mimetype || '').toLowerCase();
      const tipo = IMAGE_MIME_TYPES.has(mimeType)
        ? 'foto'
        : (VIDEO_MIME_TYPES.has(mimeType) ? 'video' : null);
      if (!tipo) throw httpError('Formato no permitido. Usá JPG, PNG, WebP, MP4 o MOV.', 400);

      const { data: post, error: postError } = await supabaseAdmin
        .from('comunidad_publicaciones')
        .select('id,autor_user_id')
        .eq('id', publicacionId)
        .maybeSingle();
      if (postError) throw postError;
      if (!post) throw httpError('La publicación ya no existe.', 404);
      if (String(post.autor_user_id) !== String(user.id)) {
        throw httpError('No podés adjuntar medios a esta publicación.', 403);
      }

      const ext = safeFileExtension(req.file);
      storagePath = `${user.id}/${publicacionId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(MEDIA_BUCKET)
        .upload(storagePath, req.file.buffer, {
          contentType: mimeType,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: media, error: mediaError } = await supabaseAdmin
        .from('comunidad_medios')
        .insert({
          publicacion_id: publicacionId,
          tipo,
          storage_path: storagePath,
          mime_type: mimeType,
          bytes: req.file.size || null,
          orden: 0,
          estado: 'listo',
        })
        .select('*')
        .single();
      if (mediaError) throw mediaError;

      const { data: signed, error: signedError } = await supabaseAdmin.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      if (signedError || !signed?.signedUrl) throw signedError || new Error('No se pudo firmar el medio.');

      // Legacy field keeps current native/web cards working while feeds migrate
      // to `comunidad_medios` and issue fresh signed URLs on every response.
      if (tipo === 'foto') {
        const { error: legacyError } = await supabaseAdmin
          .from('comunidad_publicaciones')
          .update({ imagen_url: signed.signedUrl, updated_at: new Date().toISOString() })
          .eq('id', publicacionId);
        if (legacyError) throw legacyError;
      }

      res.status(201).json({ media, url: signed.signedUrl });
    } catch (error) {
      if (storagePath) {
        await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([storagePath]).catch(() => {});
      }
      const status = error?.status || 500;
      if (status >= 400 && status < 500) return res.status(status).json({ error: error.message });
      console.error('POST /api/comunidad/publicaciones/:id/media:', error?.message || error);
      return res.status(500).json({ error: 'No se pudo subir el medio.' });
    }
  });
}
