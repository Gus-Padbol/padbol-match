import {createCommercialReviewApi} from './commercialReviewApi';
jest.mock('./apiPublicBaseUrl',()=>({getApiBaseUrl:()=>''}));
test('envía una decisión individual y versión con la sesión',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({})});await createCommercialReviewApi('session').decide('case','event','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','other');expect(global.fetch).toHaveBeenCalledWith('/api/admin/crm/commercial-review/case/event',expect.objectContaining({method:'POST',body:JSON.stringify({version:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',decision:'other'}),headers:expect.objectContaining({Authorization:'Bearer session'})}));
});
test('rechaza decisiones o versiones inválidas sin enviarlas',async()=>{
 global.fetch=jest.fn();await expect(createCommercialReviewApi('session').decide('a','b',null,'commercial')).rejects.toThrow();await expect(createCommercialReviewApi('session').decide('a','b',1,'anything')).rejects.toThrow();expect(global.fetch).not.toHaveBeenCalled();
});
