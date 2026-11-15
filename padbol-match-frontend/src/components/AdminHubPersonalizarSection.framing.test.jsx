import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import AdminHubPersonalizarSection from './AdminHubPersonalizarSection';

const mockT = key => key;
let mockCropProps;
jest.mock('../i18n/adminTranslation', () => ({useSafeTranslation: () => ({t: mockT}), stripAdminEmoji: text => text}));
jest.mock('./ImageCropModal', () => props => {mockCropProps = props; return props.open ? <div role="dialog">Crop opened<button onClick={props.onClose}>Cancel crop</button></div> : null;});

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ok: true, json: async () => []}));
  URL.createObjectURL = jest.fn(() => 'blob:hub-photo');
  URL.revokeObjectURL = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

test('preview and crop use the same phone frame, with cover positioning rather than unrelated 16:9', async () => {
  render(<AdminHubPersonalizarSection apiBaseUrl="https://example.test" accessToken="test-session" />);
  const selector = await screen.findByLabelText('Encuadre de la foto');
  expect(mockCropProps.aspect).toBe(358 / 160);
  const image = screen.getAllByAltText('Vista previa del encuadre del hub')[0];
  expect(image).toHaveStyle({objectFit: 'cover', objectPosition: 'center'});
  expect(screen.getAllByTestId('hub-photo-frame')[0].style.aspectRatio).toBe('358 / 160');
  fireEvent.change(selector, {target: {value: 'inicio'}});
  expect(mockCropProps.aspect).toBe(358 / 100);
  expect(screen.getAllByTestId('hub-photo-frame')[0].style.aspectRatio).toBe('358 / 100');
  // A selected photo opens the existing movable/zoomable crop; no write until confirmation.
  fireEvent.click(screen.getAllByText('admin.hub.changePhoto')[0]);
  fireEvent.change(screen.getByTestId('hub-deporte-file'), {target: {files: [new File(['photo'], 'photo.jpg', {type: 'image/jpeg'})]}});
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(mockCropProps.imageSrc).toBe('blob:hub-photo');
  expect(mockCropProps.aspect).toBe(358 / 100);
  await waitFor(() => expect(fetch.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true));
});

test('Android frame also controls both preview and crop without altering published photos', async () => {
  render(<AdminHubPersonalizarSection apiBaseUrl="https://example.test" accessToken="test-session" />);
  fireEvent.change(await screen.findByLabelText('Encuadre de la foto'), {target: {value: 'jugar_android'}});
  expect(mockCropProps.aspect).toBe(358 / 147);
  expect(screen.getAllByTestId('hub-photo-frame')[0].style.aspectRatio).toBe('358 / 147');
  expect(fetch.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
});

test('existing photo can be reframed without choosing another file or changing published data on open/cancel', async () => {
  render(<AdminHubPersonalizarSection apiBaseUrl="https://example.test" accessToken="test-session" />);
  await screen.findByLabelText('Encuadre de la foto');
  const currentImage = screen.getAllByAltText('Vista previa del encuadre del hub')[0];
  fireEvent.click(screen.getAllByText('Ajustar encuadre')[0]);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(mockCropProps.imageSrc).toBe(currentImage.getAttribute('src'));
  expect(mockCropProps.busy).toBe(false);
  fireEvent.click(screen.getByText('Cancel crop'));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(fetch.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
});
