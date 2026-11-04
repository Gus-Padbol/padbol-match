import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import CommercialProspects from './CommercialProspects';

const prospect={id:'p1',name:'Miami Soccer Center',city:'Miami',state:'Florida',country:'US',sector:'soccer',score:82,grade:'B',status:'verified',score_breakdown:[{key:'sport',label:'Afinidad',points:25,max:25,inferred:false}],source_url:'https://www.openstreetmap.org/node/1',website:'https://example.com',last_verified_at:'2026-11-03T00:00:00Z'};
const api={prospectStatus:async()=>({enabled:true,sendEnabled:false,role:'manager'}),listProspects:async()=>({prospects:[prospect]}),prospectDashboard:async()=>({totals:{prospects:1,verified:1},byCountry:[['US',1]],runs:[],sourceCostCents:0}),listProspectCampaigns:async()=>({campaigns:[]}),searchProspects:jest.fn().mockResolvedValue({found:1,inserted:1,updated:0,excluded:0,attribution:'© OpenStreetMap'}),readProspect:async()=>({prospect,events:[],messages:[]}),updateProspect:jest.fn(),createProspectCampaign:jest.fn(),simulateProspectCampaign:jest.fn(),prospectResponse:jest.fn()};

test('muestra prospectos reales con puntuación explicable y modo simulación',async()=>{
 render(<CommercialProspects api={api}/>);
 await screen.findByText('Miami Soccer Center');
 expect(screen.getByText(/Modo simulación/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/Miami Soccer Center/}));
 await screen.findByText('Puntuación explicable');
 expect(screen.getAllByText('82').length).toBeGreaterThan(0);
 expect(screen.getByText(/Afinidad/)).toBeInTheDocument();
});

test('ejecuta búsqueda pública desde la pestaña y no envía correos',async()=>{
 const searched={...api,searchProspects:jest.fn().mockResolvedValue({found:1,inserted:1,updated:0,excluded:0,attribution:'© OpenStreetMap'})};
 render(<CommercialProspects api={searched}/>);await screen.findByText('Miami Soccer Center');
 fireEvent.click(screen.getByRole('button',{name:'Buscar prospectos ahora'}));
 await waitFor(()=>expect(searched.searchProspects).toHaveBeenCalled());
 expect(await screen.findByText(/Búsqueda completada/)).toBeInTheDocument();
});

test('el panel ejecutivo separa métricas y costos',async()=>{
 render(<CommercialProspects api={api}/>);await screen.findByText('Miami Soccer Center');fireEvent.click(screen.getByRole('tab',{name:'Panel ejecutivo'}));expect(await screen.findByRole('heading',{name:'Panel ejecutivo'})).toBeInTheDocument();expect(screen.getByText(/Costo de búsqueda/)).toBeInTheDocument();expect(screen.getByText(/aperturas de correo/)).toBeInTheDocument();
});
