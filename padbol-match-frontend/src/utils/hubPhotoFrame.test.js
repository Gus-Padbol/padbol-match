import {hubPhotoFrames, centeredCoverWindow, hubPhotoSafeArea} from './hubPhotoFrame';

test('build78 image rectangles include Home offset/borders and Jugar borders', () => {
  const frames = hubPhotoFrames({width:390,height:844,topInset:47,bottomInset:34});
  expect(frames).toEqual([{id:'inicio',label:'Inicio',width:342,height:98},{id:'jugar',label:'Jugar',width:355,height:158.5}]);
  expect(hubPhotoFrames({width:430,height:932,topInset:59,bottomInset:34})[0]).toMatchObject({width:382,height:113});
  expect(hubPhotoFrames({width:390,height:844,topInset:47,bottomInset:34,isGuest:true})[0].height).toBe(88);
});
test('whole-photo fit places every original corner in the intersection retained in both cards', () => {
  for(const viewport of [{width:375,height:812,topInset:44,bottomInset:34},{width:390,height:844,topInset:47,bottomInset:34},{width:430,height:932,topInset:59,bottomInset:34}]) {
    const frames = hubPhotoFrames(viewport);
    const canvas = {width:1200,height:1200/(frames[1].width/frames[1].height)};
    const safe = hubPhotoSafeArea(canvas.width,canvas.height,frames);
    const original = {width:900,height:600};
    const scale = Math.min(safe.width/original.width,safe.height/original.height);
    const photo = {x:(canvas.width-original.width*scale)/2,y:(canvas.height-original.height*scale)/2,width:original.width*scale,height:original.height*scale};
    for(const frame of frames) {
      const visible = centeredCoverWindow(canvas.width,canvas.height,frame);
      expect(photo.x+0.001).toBeGreaterThanOrEqual(visible.x);
      expect(photo.y+0.001).toBeGreaterThanOrEqual(visible.y);
      expect(photo.x+photo.width-0.001).toBeLessThanOrEqual(visible.x+visible.width);
      expect(photo.y+photo.height-0.001).toBeLessThanOrEqual(visible.y+visible.height);
    }
  }
});
