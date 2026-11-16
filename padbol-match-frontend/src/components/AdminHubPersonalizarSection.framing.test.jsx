import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import AdminHubPersonalizarSection from './AdminHubPersonalizarSection';
import {fetchHubPhotoSource, saveHubPhotoEdit} from '../utils/hubPhotoEditorApi';

const mockT=key=>key;
let mockEditorProps;
jest.mock('../i18n/adminTranslation',()=>({useSafeTranslation:()=>({t:mockT}),stripAdminEmoji:text=>text}));
jest.mock('../utils/hubPhotoEditorApi',()=>({fetchHubPhotoSource:jest.fn(),saveHubPhotoEdit:jest.fn()}));
jest.mock('./HubPhotoEditorModal',()=>props=>{mockEditorProps=props;return props.open?<div role="dialog"><button disabled={props.busy} onClick={props.onClose}>Cancel edit</button><button disabled={props.busy} onClick={()=>props.onConfirm(new File(['crop'],'final.jpg',{type:'image/jpeg'}),{pixels:{x:-10,y:-15,width:1200,height:535},originalSrc:props.originalSrc})}>Confirm edit</button>{props.error?<p role="alert">{props.error}</p>:null}</div>:null;});
const sourceId='ae42ea2e-c955-4574-9b96-23c1b6664fb1';
const source={sourceId,imageUrl:'https://example.test/output.jpg',frame:{pixels:{x:-10,y:-15,width:1200,height:535},viewport:{width:390,height:844}},original:new Blob(['original'],{type:'image/jpeg'})};
const props={apiBaseUrl:'https://api.example.test',accessToken:'test-session'};
const renderEditor=()=>render(<AdminHubPersonalizarSection {...props}/>);
const card=()=>screen.getByTestId('hub-editor-padbol|armar_partido');
const newPhoto=()=>{const file=new File(['source'],'original.jpg',{type:'image/jpeg'});fireEvent.click(within(card()).getByText('admin.hub.changePhoto'));fireEvent.change(screen.getByTestId('hub-deporte-file'),{target:{files:[file]}});return file;};
beforeEach(()=>{
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>[]}));
 URL.createObjectURL=jest.fn(()=> 'blob:original-source');URL.revokeObjectURL=jest.fn();
 fetchHubPhotoSource.mockReset().mockResolvedValue(source);
 saveHubPhotoEdit.mockReset().mockImplementation(async({target})=>({source_id:sourceId,image_url:'https://example.test/output.jpg',row:{deporte:target.deporte,card_key:target.cardKey,imagen_url:'https://example.test/output.jpg'}}));
});
afterEach(()=>jest.restoreAllMocks());

test('Home and Jugar are always previewed together using the image rectangles from build78',async()=>{
 renderEditor();await screen.findByLabelText('Comprobar las vistas del teléfono');
 const frames=within(card()).getAllByTestId('hub-photo-frame');
 expect(frames.map(node=>node.style.aspectRatio)).toEqual(['342 / 98','355 / 158.5']);
 fireEvent.change(screen.getByLabelText('Comprobar las vistas del teléfono'),{target:{value:'large'}});
 expect(frames.map(node=>node.style.aspectRatio)).toEqual(['382 / 113','395 / 158.5']);
 expect(saveHubPhotoEdit).not.toHaveBeenCalled();
});

test('new photo preserves its original; successful save closes and reopen recovers original+pixels from server',async()=>{
 renderEditor();await screen.findByLabelText('Comprobar las vistas del teléfono');const file=newPhoto();
 expect(await screen.findByRole('dialog')).toBeInTheDocument();expect(mockEditorProps.originalSrc).toBe('blob:original-source');
 fireEvent.click(screen.getByText('Confirm edit'));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(saveHubPhotoEdit).toHaveBeenCalledWith(expect.objectContaining({target:{kind:'deporte',deporte:'padbol',cardKey:'armar_partido',expectedImageUrl:null},expectedImageUrl:null,original:file,sourceId:null,frame:expect.objectContaining({pixels:{x:-10,y:-15,width:1200,height:535}})}));
 expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:original-source');
 fireEvent.click(within(card()).getByText('Ajustar encuadre'));expect(await screen.findByRole('dialog')).toBeInTheDocument();
 expect(fetchHubPhotoSource).toHaveBeenCalledWith(expect.objectContaining({expectedImageUrl:'https://example.test/output.jpg'}));
 expect(mockEditorProps.initialPixels).toEqual(source.frame.pixels);
 fireEvent.click(screen.getByText('Confirm edit'));await waitFor(()=>expect(saveHubPhotoEdit).toHaveBeenCalledTimes(2));
 expect(saveHubPhotoEdit.mock.calls[1][0]).toMatchObject({sourceId,original:null,expectedImageUrl:'https://example.test/output.jpg'});
});

test('cancel does not publish; missing original never opens the already-cropped photo as a source',async()=>{
 renderEditor();await screen.findByLabelText('Comprobar las vistas del teléfono');newPhoto();fireEvent.click(screen.getByText('Cancel edit'));
 expect(saveHubPhotoEdit).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).toBeNull();
 fetchHubPhotoSource.mockRejectedValueOnce(new Error('Esta foto no conserva el original. Elige la foto original.'));
 fireEvent.click(within(card()).getByText('Ajustar encuadre'));
 expect((await screen.findAllByRole('alert')).some((node) => /Elige la foto original/.test(node.textContent || ''))).toBe(true);expect(screen.queryByRole('dialog')).toBeNull();expect(saveHubPhotoEdit).not.toHaveBeenCalled();
});

test('failed save keeps original and editor open, retry uses the same source and target',async()=>{
 renderEditor();await screen.findByLabelText('Comprobar las vistas del teléfono');const file=newPhoto();
 saveHubPhotoEdit.mockRejectedValueOnce(new Error('No se pudo guardar el original'));
 fireEvent.click(screen.getByText('Confirm edit'));expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el original');
 expect(screen.getByRole('dialog')).toBeInTheDocument();expect(mockEditorProps.originalSrc).toBe('blob:original-source');
 fireEvent.click(screen.getByText('Confirm edit'));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(saveHubPhotoEdit.mock.calls[1][0].original).toBe(file);
});

test('late original load after changing sport or auth does not open the wrong photo',async()=>{
 const {rerender}=renderEditor();await screen.findByLabelText('Comprobar las vistas del teléfono');
 let resolveSource;fetchHubPhotoSource.mockImplementationOnce(()=>new Promise(resolve=>{resolveSource=resolve;}));
 fireEvent.click(within(card()).getByText('Ajustar encuadre'));
 fireEvent.change(screen.getByLabelText('admin.hub.sportForCards'),{target:{value:'padel'}});
 await act(async()=>resolveSource(source));expect(screen.queryByRole('dialog')).toBeNull();expect(URL.createObjectURL).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('admin.hub.sportForCards'),{target:{value:'padbol'}});
 fetchHubPhotoSource.mockImplementationOnce(()=>new Promise(resolve=>{resolveSource=resolve;}));
 fireEvent.click(within(card()).getByText('Ajustar encuadre'));rerender(<AdminHubPersonalizarSection {...props} accessToken="another-session"/>);
 await act(async()=>resolveSource(source));expect(screen.queryByRole('dialog')).toBeNull();expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('Next Generation opens with stored null CAS, not the preview URL',async()=>{
 renderEditor();await screen.findByLabelText('Comprobar las vistas del teléfono');
 const cardNext=screen.getByText('Next Generation · Padbol').closest('.admin-hub-editor-card');
 fireEvent.click(within(cardNext).getByText('Ajustar encuadre'));
 await waitFor(()=>expect(fetchHubPhotoSource).toHaveBeenCalledWith(expect.objectContaining({target:expect.objectContaining({kind:'deporte',deporte:'padbol',card_key:'next_generation'}),expectedImageUrl:null})));
});
