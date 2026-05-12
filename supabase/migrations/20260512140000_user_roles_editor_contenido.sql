-- Añade el rol editor_contenido al CHECK de user_roles (ajusta el nombre del constraint si en tu DB difiere).

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check CHECK (
    role = ANY (
      ARRAY[
        'super_admin'::text,
        'admin_nacional'::text,
        'admin_club'::text,
        'empleado'::text,
        'editor_contenido'::text
      ]
    )
  );
