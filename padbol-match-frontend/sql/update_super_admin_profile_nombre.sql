-- Supabase SQL Editor: asignar nombre al perfil del super admin (tabla public.profiles, PK = auth user id).
-- Si tu tabla no tiene columna `nombre`, adaptá el SET.

update public.profiles p
set nombre = 'Gustavo'
from auth.users u
where p.id = u.id
  and lower(u.email) = 'padbolinternacional@gmail.com';
