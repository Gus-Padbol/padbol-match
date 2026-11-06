import React,{useState,createContext,useContext} from 'react';
const C=createContext(null);
export function FixtureAuth({children}){const[role,setRole]=useState('super_admin');return <C.Provider value={{session:{access_token:role,user:{id:'fixture',email:'qa@example.invalid',user_metadata:{full_name:'Equipo QA'}}},signOutAndClear:()=>{}}}><label style={{display:'block',padding:6,background:'#fff8d9',font:'12px Arial'}}>PRUEBA LOCAL · sin conexiones externas · Rol <select value={role} onChange={e=>setRole(e.target.value)}><option>super_admin</option><option>advisor</option><option>jugador</option><option>failed</option></select></label>{children}</C.Provider>}
export const useAuth=()=>useContext(C);
