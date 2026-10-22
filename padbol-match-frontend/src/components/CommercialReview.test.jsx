import React from 'react';import {render,screen,fireEvent,waitFor} from '@testing-library/react';import CommercialReview from './CommercialReview';
test('clasifica solo el mensaje elegido con su versión y mantiene el caso en revisión',async()=>{
 const item={caseId:'case',eventId:'event',body:'Consulta comercial',version:7,caseStatus:'suspended'};const api={list:jest.fn().mockResolvedValueOnce({items:[item]}).mockResolvedValue({items:[]}),decide:jest.fn().mockResolvedValue({decision:'commercial',status:'suspended'})};
 render(<CommercialReview api={api}/>);await screen.findByText('Consulta comercial');fireEvent.click(screen.getByText('Es comercial'));await waitFor(()=>expect(api.decide).toHaveBeenCalledWith('case','event',7,'commercial'));expect(await screen.findByText(/permanece en revisión/)).toBeInTheDocument();
});
test('ante un conflicto retira la selección y exige actualizar antes de repetir',async()=>{
 const api={list:jest.fn().mockResolvedValue({items:[{caseId:'case',eventId:'event',body:'Consulta',version:2,caseStatus:'suspended'}]}),decide:jest.fn().mockRejectedValue({status:409})};render(<CommercialReview api={api}/>);await screen.findByText('Consulta');fireEvent.click(screen.getByText('Es de otra área'));expect(await screen.findByRole('alert')).toHaveTextContent('Actualiza la lista');expect(screen.queryByText('Consulta')).not.toBeInTheDocument();
});

test('una consulta cerrada no se incorpora como comercial',async()=>{const api={list:jest.fn().mockResolvedValue({items:[{caseId:'case',eventId:'event',body:'Cerrado',version:1,caseStatus:'closed'}]})};render(<CommercialReview api={api}/>);await screen.findByText('Cerrado');expect(screen.getByText('Es comercial')).toBeDisabled();expect(screen.getByText('Es de otra área')).toBeEnabled();});
