import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TournamentAccreditationPanel from './TournamentAccreditationPanel';
const text = es => es;
const base = { participants: [], can_accredit: true, can_homologate: true, homologacion: { estado: 'pendiente' }, accreditation_requests: [] };
const mount = (catalog = base) => { const request = jest.fn().mockResolvedValue({ ok: true }); const perform = jest.fn(action => action()); render(<TournamentAccreditationPanel catalog={catalog} busy={false} text={text} request={request} perform={perform} requestId={() => '11111111-1111-4111-8111-111111111111'} />); return { request, perform }; };
test('homologation requires an official reference, reviewed evidence and explicit confirmation', () => {
  const { request } = mount(); const button = screen.getByRole('button', { name: 'Confirmar homologación' }); expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Referencia oficial de la decisión'), { target: { value: 'FIPA QA ref' } });
  fireEvent.change(screen.getByLabelText('Evidencia revisada y requisitos comprobados'), { target: { value: 'Evidencia sintética de prueba suficiente' } }); expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(button);
  expect(request).toHaveBeenCalledWith('/homologacion', expect.objectContaining({ referencia_oficial: 'FIPA QA ref', confirmar_evento_oficial: true, confirmar_requisitos: true }));
});
test('QA or nonofficial event permissions do not offer homologation', () => {
  mount({ ...base, can_homologate: false, homologation_block_reason: 'Los torneos QA no acreditan ranking oficial.' });
  expect(screen.queryByRole('button', { name: 'Confirmar homologación' })).not.toBeInTheDocument(); expect(screen.getByText('Los torneos QA no acreditan ranking oficial.')).toBeInTheDocument();
});
test('an own linked profile requests review without supplying a different user or awarding points', () => {
  const { request } = mount({ ...base, can_accredit: false, can_homologate: false, participants: [{ id: 'own', nombre: 'QA Persona', can_request_accreditation: true }] });
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar revisión para ranking oficial' }));
  expect(request).toHaveBeenCalledWith('/participantes/own/acreditacion', { request_id: expect.any(String) }); expect(screen.queryByRole('button', { name: 'Aprobar elegibilidad' })).not.toBeInTheDocument();
});
test('individual approval remains disabled without event homologation, reviewed evidence and confirmation', () => {
  mount({ ...base, accreditation_requests: [{ id: 'r', participante_id: 'p', nombre_solicitante: 'QA Persona', estado: 'pendiente' }] });
  fireEvent.change(screen.getByLabelText('Referencia oficial', { exact: true }), { target: { value: 'FIPA QA ref' } }); fireEvent.change(screen.getByLabelText('Evidencia de identidad y requisitos revisados'), { target: { value: 'Identidad y requisitos sintéticos revisados' } });
  fireEvent.click(screen.getAllByRole('checkbox')[1]); expect(screen.getByRole('button', { name: 'Aprobar elegibilidad' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Rechazar acreditación' })).toBeEnabled();
});
test('enabling FIPA enrollment during homologation requires its own explicit choice', () => {
  const { request } = mount({ ...base, homologation_requires_fipa_enablement: true });
  fireEvent.change(screen.getByLabelText('Referencia oficial de la decisión'), { target: { value: 'FIPA QA ref' } });
  fireEvent.change(screen.getByLabelText('Evidencia revisada y requisitos comprobados'), { target: { value: 'Evidencia sintética de prueba suficiente' } });
  fireEvent.click(screen.getAllByRole('checkbox')[0]); const button = screen.getByRole('button', { name: 'Confirmar homologación' }); expect(button).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Activar inscripción FIPA para este torneo al homologarlo.')); fireEvent.click(button);
  expect(request).toHaveBeenCalledWith('/homologacion', expect.objectContaining({ habilitar_inscripcion_fipa: true }));
});
