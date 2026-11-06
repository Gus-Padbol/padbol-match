beforeEach(()=>{if(global.XMLHttpRequest)jest.spyOn(global.XMLHttpRequest.prototype,'open').mockImplementation(()=>{throw new Error('QA network blocked');});});
afterEach(()=>{if(global.XMLHttpRequest&&jest.isMockFunction(global.XMLHttpRequest.prototype.open))global.XMLHttpRequest.prototype.open.mockRestore();});
