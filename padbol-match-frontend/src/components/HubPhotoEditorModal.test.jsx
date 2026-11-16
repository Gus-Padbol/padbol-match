import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import HubPhotoEditorModal, {renderHubPhoto} from './HubPhotoEditorModal';
import {hubPhotoFrames} from '../utils/hubPhotoFrame';

let mockCropperProps;
const mockCreateImage = jest.fn();
jest.mock('react-easy-crop', () => props => {mockCropperProps=props; return <div data-testid="cropper"/>;});
jest.mock('../utils/cropImage', () => ({createImage: (...args)=>mockCreateImage(...args)}));
const frames=hubPhotoFrames({width:390,height:844,topInset:47,bottomInset:34});
const pixels={x:-100,y:-120,width:1200,height:1200/(355/158.5)};

test('both live previews use the same original and padded composition; reopen restores source pixels', () => {
  const props={open:true,originalSrc:'https://example.test/original.jpg',frames,onClose:jest.fn(),onConfirm:jest.fn()};
  const {rerender}=render(<HubPhotoEditorModal {...props}/>);
  expect(mockCropperProps.restrictPosition).toBe(false);
  expect(mockCropperProps.minZoom).toBe(0.1);
  act(()=>{mockCropperProps.onMediaLoaded({width:390,height:260,naturalWidth:900,naturalHeight:600});mockCropperProps.onCropSizeChange({width:390,height:390/(355/158.5)});mockCropperProps.onCropComplete({},pixels);});
  expect(screen.getByTestId('hub-live-preview-inicio').style.aspectRatio).toBe('342 / 98');
  expect(screen.getByTestId('hub-live-preview-jugar').style.aspectRatio).toBe('355 / 158.5');
  fireEvent.click(screen.getByText('Foto completa'));
  expect(mockCropperProps.zoom).toBeLessThan(1);
  expect(mockCropperProps.crop).toEqual({x:0,y:0});
  rerender(<HubPhotoEditorModal {...props} open={false}/>);
  rerender(<HubPhotoEditorModal {...props} initialPixels={pixels}/>);
  expect(mockCropperProps.image).toBe('https://example.test/original.jpg');
  expect(mockCropperProps.initialCroppedAreaPixels).toEqual(pixels);
});

test('export draws the complete source with padding instead of discarding source pixels', async () => {
  const image={naturalWidth:900,naturalHeight:600};mockCreateImage.mockResolvedValue(image);
  const context={fillRect:jest.fn(),drawImage:jest.fn()};
  const getContext=jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);
  const toBlob=jest.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(callback=>callback(new Blob(['composed'],{type:'image/jpeg'})));
  const view=await renderHubPhoto('https://example.test/original.jpg',{x:-100,y:-120,width:1200,height:600});
  expect(context.fillRect).toHaveBeenCalledWith(0,0,1200,600);
  expect(context.drawImage).toHaveBeenCalledWith(image,100,120,900,600);
  expect(view.name).toBe('hub-encuadre.jpg');
  getContext.mockRestore();toBlob.mockRestore();
});

test('cancel while composing does not call a stale confirmation after another editor can open',async()=>{
 let finishImage;mockCreateImage.mockImplementationOnce(()=>new Promise(resolve=>{finishImage=resolve;}));
 const context={fillRect:jest.fn(),drawImage:jest.fn()};
 const getContext=jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);
 const toBlob=jest.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(callback=>callback(new Blob(['composed'],{type:'image/jpeg'})));
 const props={open:true,originalSrc:'https://example.test/original.jpg',frames,onClose:jest.fn(),onConfirm:jest.fn()};
 const {rerender}=render(<HubPhotoEditorModal {...props}/>);
 act(()=>{mockCropperProps.onMediaLoaded({width:390,height:260,naturalWidth:900,naturalHeight:600});mockCropperProps.onCropSizeChange({width:390,height:390/(355/158.5)});mockCropperProps.onCropComplete({},pixels);});
 fireEvent.click(screen.getByText('Guardar encuadre'));
 rerender(<HubPhotoEditorModal {...props} open={false}/>);
 await act(async()=>{finishImage({naturalWidth:900,naturalHeight:600});await Promise.resolve();await Promise.resolve();});
 expect(props.onConfirm).not.toHaveBeenCalled();getContext.mockRestore();toBlob.mockRestore();
});

test('onCropAreaChange updates the live pixels without waiting for another CropComplete', async () => {
  const image={naturalWidth:900,naturalHeight:600};mockCreateImage.mockResolvedValue(image);
  const context={fillRect:jest.fn(),drawImage:jest.fn()};
  const getContext=jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);
  const toBlob=jest.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(callback=>callback(new Blob(['composed'],{type:'image/jpeg'})));
  const props={open:true,originalSrc:'https://example.test/original.jpg',frames,safeFrames:frames,onClose:jest.fn(),onConfirm:jest.fn()};
  render(<HubPhotoEditorModal {...props}/>);
  act(()=>{mockCropperProps.onMediaLoaded({width:390,height:260,naturalWidth:900,naturalHeight:600});mockCropperProps.onCropSizeChange({width:390,height:390/(355/158.5)});});
  const moved={x:-44,y:-55,width:900,height:500};
  act(()=>mockCropperProps.onCropAreaChange({},moved));
  fireEvent.click(screen.getByText('Guardar encuadre'));
  await act(async()=>{await Promise.resolve();await Promise.resolve();});
  expect(props.onConfirm).toHaveBeenCalledWith(expect.any(File),expect.objectContaining({pixels:moved}));
  getContext.mockRestore();toBlob.mockRestore();
});

test('interior destination uses one neutral preview and no Inicio/Jugar labels',()=>{
 const interior=[{...frames[0],id:'interior',label:'Vista previa del recorte'}];
 const props={open:true,originalSrc:'https://example.test/original.jpg',frames:interior,safeFrames:interior,onClose:jest.fn(),onConfirm:jest.fn()};
 render(<HubPhotoEditorModal {...props}/>);
 expect(screen.queryByText('Inicio')).toBeNull();
 expect(screen.queryByText('Jugar')).toBeNull();
 expect(screen.getByText('Vista previa del recorte')).toBeInTheDocument();
 expect(screen.getByText(/Mové la foto/)).toBeInTheDocument();
});
