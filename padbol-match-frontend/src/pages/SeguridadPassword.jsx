import React, {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {supabase} from '../supabaseClient';
import {useAuth} from '../context/AuthContext';

/**
 * Establecer o cambiar la contraseña del PROPIO usuario autenticado (también si entró por OTP).
 * Nunca crea cuentas ni cambia roles; usa supabase.auth.updateUser sobre la sesión actual.
 */
export default function SeguridadPassword() {
  const {session, loading} = useAuth();
  const navigate = useNavigate();
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const volver = '/mi-perfil';

  const guardar = async (event) => {
    event.preventDefault();
    if (guardando) return;
    setError(null);
    if (!session?.user?.id) { setError('Necesitás iniciar sesión para cambiar tu contraseña.'); return; }
    if (String(nueva).length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (nueva !== repetir) { setError('Las contraseñas no coinciden.'); return; }
    setGuardando(true);
    try {
      const { data } = await supabase.auth.getSession();
      const actual = data?.session?.user?.id ? String(data.session.user.id) : null;
      if (!actual || actual !== String(session.user.id)) {
        setError('La sesión cambió. Volvé a iniciar sesión y reintentá.');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: nueva });
      if (updateError) { setError('No pudimos guardar la contraseña. Reintentá en unos minutos.'); return; }
      setNueva(''); setRepetir(''); setListo(true);
    } catch {
      setError('No pudimos guardar la contraseña. Reintentá en unos minutos.');
    } finally { setGuardando(false); }
  };

  if (loading) return <main style={{minHeight:'50vh',display:'grid',placeItems:'center'}}>Cargando…</main>;
  if (!session?.user) return <main style={{minHeight:'50vh',display:'grid',placeItems:'center',padding:24}}>
    <p>Iniciá sesión para gestionar tu contraseña. <Link to="/login">Ir a ingresar</Link></p>
  </main>;

  return (
    <main style={{minHeight:'50vh',display:'grid',placeItems:'center',padding:24}}>
      <form onSubmit={guardar} style={{maxWidth:460,width:'100%',color:'var(--text-primary)'}}>
        <h1 style={{fontSize:'1.35rem'}}>Contraseña y seguridad</h1>
        {listo ? (
          <>
            <p role="status">Tu contraseña quedó guardada. Podés usarla la próxima vez que ingreses.</p>
            <button type="button" onClick={() => navigate(volver)}>Volver a mi perfil</button>
          </>
        ) : (
          <>
            <p>Establecé una contraseña para entrar también sin código al email. Es tu propia cuenta.</p>
            {error ? <p role="alert" style={{color:'#b91c1c'}}>{error}</p> : null}
            <label style={{display:'block',marginTop:12}}>Contraseña nueva
              <input type="password" autoComplete="new-password" value={nueva} onChange={(e)=>setNueva(e.target.value)} style={{display:'block',width:'100%',marginTop:4}} />
            </label>
            <label style={{display:'block',marginTop:12}}>Repetir contraseña
              <input type="password" autoComplete="new-password" value={repetir} onChange={(e)=>setRepetir(e.target.value)} style={{display:'block',width:'100%',marginTop:4}} />
            </label>
            <button type="submit" disabled={guardando} style={{marginTop:16}}>{guardando ? 'Guardando…' : 'Guardar contraseña'}</button>
            <p style={{marginTop:12}}><Link to={volver}>Volver a mi perfil</Link></p>
          </>
        )}
      </form>
    </main>
  );
}
